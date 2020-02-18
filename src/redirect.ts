import * as crypto from "crypto";

import { AddressRecordTarget, HostedZone, IHostedZone } from "@aws-cdk/aws-route53";
import { BlockPublicAccess, Bucket, BucketEncryption } from "@aws-cdk/aws-s3";
import {
	CloudFrontAllowedMethods,
	CloudFrontWebDistribution,
	HttpVersion,
	LambdaEdgeEventType,
	OriginAccessIdentity,
	PriceClass,
} from "@aws-cdk/aws-cloudfront";
import { Code, Function, Runtime } from "@aws-cdk/aws-lambda";
import { CompositePrincipal, PolicyStatement, Role, ServicePrincipal } from "@aws-cdk/aws-iam";
import { Construct, RemovalPolicy } from "@aws-cdk/core";

import { ARecord } from "@aws-cdk/aws-route53/lib/record-set";
import { Certificate } from "@aws-cdk/aws-certificatemanager";
import { CloudFrontTarget } from "@aws-cdk/aws-route53-targets";

type CertificateType = string | Certificate;
type HostnamesType = string | string[];

interface PreserveProps {
	path: boolean;
	query: boolean;
}

interface PreserveOptions {
	path?: boolean;
	query?: boolean;
}

type PreserveType = boolean | PreserveOptions;

const defaultPreserveOpts = {
	path: true,
	query: true,
};

interface DomainOptions {
	zoneName: string;
	cert: CertificateType;
	target: string;
	hostnames?: HostnamesType;
	preserve?: PreserveType;
}

type DomainRedirectProps = DomainOptions | DomainOptions[];

interface Domain {
	name: string;
	zone: IHostedZone;
	acmCertificateArn: string;
	hostnames: string[];
	target: string;
	preserve: PreserveProps;
}

export function makeRedirect(target: string, preservePath = false, preserveQuery = false): string {
	return `
exports.handler = function(event, context, callback) {
	const request = event.Records[0].cf.request;
	const response = event.Records[0].cf.response;
	const headers = response.headers;
	response.status = "301";
	let redirect = "${target}";
	if (${preservePath.toString()}) {
		redirect += request.uri;
	}
	if (${preserveQuery.toString()}) {
		redirect += "?" + request.querystring;
	}
	headers.location = [{"key": "Location", "value": redirect}];
	callback(null, response);
};`.trim();
}

export function hash(code: string): string {
	const sum = crypto.createHash("sha256");
	sum.update(code);
	return sum.digest("hex");
}

const isValidDomain = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,11}?$/;

export class DomainRedirect extends Construct {
	public constructor(scope: Construct, id: string, props: DomainRedirectProps) {
		super(scope, id);

		if (!Array.isArray(props)) {
			props = [props];
		}

		// Retrieve an IHosted zone from DomainOptions.zone property
		const makeZone = (zoneName: string): IHostedZone => {
			if (isValidDomain.test(zoneName)) {
				return HostedZone.fromLookup(this, `${zoneName.replace(".", "-")}-zone`, {
					domainName: zoneName,
				});
			}
			throw new Error("Invalid domain");
		};

		// Retrieve the certificate ARN from DomainOptions.cert property
		const makeCert = (cert: CertificateType): string => {
			return typeof cert === "string" ? cert : cert.certificateArn;
		};

		// Set hostnames to the apex domain and www suddomain if DomainOptions.hostnames property is omitted
		const makeHostnames = (zone: IHostedZone, hostnames?: HostnamesType): string[] => {
			if (!hostnames) {
				const { zoneName } = zone;
				return [zoneName, `www.${zoneName}`];
			}
			if (typeof hostnames === "string") {
				return [hostnames];
			}
			return hostnames;
		};

		const makeOptions = (domain: DomainOptions): Domain => {
			const zone = makeZone(domain.zoneName);
			const acmCertificateArn = makeCert(domain.cert);
			const hostnames = makeHostnames(zone, domain.hostnames);
			const name = hostnames[0].replace(".", "-");
			let preserve = defaultPreserveOpts;
			if (domain.preserve === false) {
				preserve = {
					path: false,
					query: false,
				};
			}
			if (typeof domain.preserve === "object") {
				preserve = Object.assign({}, defaultPreserveOpts, domain.preserve);
			}
			return {
				zone,
				acmCertificateArn,
				hostnames,
				target: domain.target,
				name,
				preserve,
			};
		};

		const domains = props.map(prop => makeOptions(prop));

		const bucket = new Bucket(this, "redirect-bucket", {
			blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
			removalPolicy: RemovalPolicy.DESTROY,
			encryption: BucketEncryption.S3_MANAGED,
		});

		const originAccessIdentity = new OriginAccessIdentity(this, "redirect-origin-access-id", {
			comment: "Origin access identity for redirection",
		});

		const policyStatement = new PolicyStatement();
		policyStatement.addActions("s3:GetBucket*");
		policyStatement.addActions("s3:GetObject*");
		policyStatement.addActions("s3:List*");
		policyStatement.addResources(bucket.bucketArn);
		policyStatement.addResources(`${bucket.bucketArn}/*`);
		policyStatement.addCanonicalUserPrincipal(originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId);

		domains.forEach(domain => {
			const { zone, acmCertificateArn, hostnames, target, preserve, name } = domain;
			const code = makeRedirect(target, preserve.path, preserve.query);
			const redirect = new Function(this, `${name}-redirect-lambda`, {
				runtime: Runtime.NODEJS_10_X,
				handler: "index.handler",
				code: Code.fromInline(code),
				role: new Role(this, `${name}-redirect-lambda-role`, {
					assumedBy: new CompositePrincipal(
						new ServicePrincipal("lambda.amazonaws.com"),
						new ServicePrincipal("edgelambda.amazonaws.com")
					),
					managedPolicies: [
						{
							managedPolicyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
						},
					],
				}),
			});
			const codeSha256 = `:sha256:${hash(code)}`;
			const version = redirect.addVersion(codeSha256);

			const distro = new CloudFrontWebDistribution(this, `${name}-distro`, {
				viewerCertificate: {
					aliases: hostnames,
					props: {
						acmCertificateArn,
						sslSupportMethod: "sni-only",
						minimumProtocolVersion: "TLSv1.1_2016",
					},
				},
				priceClass: PriceClass.PRICE_CLASS_ALL,
				httpVersion: HttpVersion.HTTP2,
				originConfigs: [
					{
						s3OriginSource: {
							s3BucketSource: bucket,
							originAccessIdentity,
						},
						behaviors: [
							{
								allowedMethods: CloudFrontAllowedMethods.ALL,
								compress: true,
								forwardedValues: {
									queryString: preserve.query,
								},
								lambdaFunctionAssociations: [
									{
										eventType: LambdaEdgeEventType.ORIGIN_RESPONSE,
										lambdaFunction: version,
									},
								],
								isDefaultBehavior: true,
							},
						],
					},
				],
			});

			hostnames.forEach(hostname => {
				new ARecord(this, `${hostname.replace(".", "-")}-record`, {
					target: AddressRecordTarget.fromAlias(new CloudFrontTarget(distro)),
					zone,
					recordName: hostname,
				});
			});
		});
	}
}
