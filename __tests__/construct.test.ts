import { App, Stack } from "@aws-cdk/core";
import { DomainRedirect, REGION_ERROR_MESSAGE } from "../src/redirect";
import { countResources, expect as expectCDK } from "@aws-cdk/assert";

import { Certificate } from "@aws-cdk/aws-certificatemanager";

class TestApp {
	public readonly stack: Stack;
	private readonly app: App;

	constructor(region = "us-east-1") {
		const account = "123456789012";
		const context = {
			[`availability-zones:${account}:${region}`]: `${region}a`,
		};
		this.app = new App({ context });
		this.stack = new Stack(this.app, "MyStack", { env: { account, region } });
	}
}

describe("DomainRedirect", (): void => {
	let stack: Stack, fromLookup: jest.Mock, fromAlias: jest.Mock, fakeCert: Certificate;
	beforeEach(() => {
		({ stack } = new TestApp());
		fromLookup = jest.fn();
		fromAlias = jest.fn();
		jest.mock("@aws-cdk/aws-route53", () => ({
			HostedZone: {
				fromLookup: fromLookup,
			},
			AddressRecordTarget: {
				fromAlias: function (): object {
					return {
						bind: fromAlias,
					};
				},
			},
		}));
		fakeCert = new Certificate(stack, "Certificate", {
			domainName: "example.com",
		});
	});
	it("looks up an IHostedZone if a valid hostname is passed as a string to DomainOptions.zoneName", function (): void {
		fromLookup.mockReturnValue({
			zoneName: "example.com.",
		});
		new DomainRedirect(stack, "redirects", {
			zoneName: "example.com",
			cert: "arn:aws:acm:us-east-1:286638428711:certificate/06599973-2b60-469f-bd73-216473c6b263",
			target: "https://spencerbeg.gs",
		});
		expectCDK(stack).to(countResources("AWS::S3::Bucket", 1));
		expectCDK(stack).to(countResources("AWS::CloudFront::Distribution", 1));
	});
	it("throws if an invalid hostname is passed as a string to DomainOptions.zoneName", function (): void {
		const fn = (): void => {
			new DomainRedirect(stack, "redirects", {
				zoneName: "garbage",
				cert: "arn:aws:acm:us-east-1:286638428711:certificate/06599973-2b60-469f-bd73-216473c6b263",
				target: "https://spencerbeg.gs",
			});
		};

		expect(fn).toThrow(new Error("Invalid domain"));
	});
	it("looks up Domain.certificateArn if a Certificate is passed to DomainOptions.cert", function (): void {
		fromLookup.mockReturnValue({
			zoneName: "example.com.",
		});
		new DomainRedirect(stack, "redirects", {
			zoneName: "example.com",
			cert: fakeCert,
			target: "https://spencerbeg.gs",
		});
		expectCDK(stack).to(countResources("AWS::S3::Bucket", 1));
		expectCDK(stack).to(countResources("AWS::CloudFront::Distribution", 1));
	});
	it("accepts a string for DomainOptions.hostnames", function (): void {
		fromLookup.mockReturnValue({
			zoneName: "example.com.",
		});
		new DomainRedirect(stack, "redirects", {
			zoneName: "example.com",
			cert: fakeCert,
			target: "https://spencerbeg.gs",
			hostnames: "foobar.example.com",
		});
		expectCDK(stack).to(countResources("AWS::S3::Bucket", 1));
		expectCDK(stack).to(countResources("AWS::CloudFront::Distribution", 1));
	});
	it("passes through an array of strings for DomainOptions.hostnames", function (): void {
		fromLookup.mockReturnValue({
			zoneName: "example.com.",
		});
		new DomainRedirect(stack, "redirects", {
			zoneName: "example.com",
			cert: fakeCert,
			target: "https://spencerbeg.gs",
			hostnames: ["foo.example.com", "bar.example.com"],
		});
		expectCDK(stack).to(countResources("AWS::S3::Bucket", 1));
		expectCDK(stack).to(countResources("AWS::CloudFront::Distribution", 1));
	});
	it("handles zoneName without a trialing period", function (): void {
		fromLookup.mockReturnValue({
			zoneName: "example.com",
		});
		new DomainRedirect(stack, "redirects", {
			zoneName: "example.com",
			cert: fakeCert,
			target: "https://spencerbeg.gs",
		});
		expectCDK(stack).to(countResources("AWS::S3::Bucket", 1));
		expectCDK(stack).to(countResources("AWS::CloudFront::Distribution", 1));
	});
	it("accepts and array of DomainOptions", () => {
		fromLookup
			.mockReturnValueOnce({
				zoneName: "domain1.com",
			})
			.mockReturnValueOnce({
				zoneName: "domain2.com",
			});
		new DomainRedirect(stack, "redirects", [
			{
				zoneName: "domain1.com",
				cert: fakeCert,
				target: "https://spencerbeg.gs",
			},
			{
				zoneName: "domain2.com",
				cert: fakeCert,
				target: "https://spencerbeg.gs",
			},
		]);
		expectCDK(stack).to(countResources("AWS::S3::Bucket", 1));
		expectCDK(stack).to(countResources("AWS::CloudFront::Distribution", 2));
	});
	it("DomainOptions.preserve can be optionally passed", () => {
		fromLookup.mockReturnValueOnce({
			zoneName: "example.com",
		});

		new DomainRedirect(stack, "redirects", {
			zoneName: "domain1.com",
			cert: fakeCert,
			target: "https://spencerbeg.gs",
			preserve: {
				path: true,
				query: false,
			},
		});
		expectCDK(stack).to(countResources("AWS::S3::Bucket", 1));
		expectCDK(stack).to(countResources("AWS::CloudFront::Distribution", 1));
	});
	it("DomainOptions.preserve can be passed as a boolean", () => {
		fromLookup.mockReturnValueOnce({
			zoneName: "example.com",
		});

		new DomainRedirect(stack, "redirects", {
			zoneName: "domain1.com",
			cert: fakeCert,
			target: "https://spencerbeg.gs",
			preserve: false,
		});
		expectCDK(stack).to(countResources("AWS::S3::Bucket", 1));
		expectCDK(stack).to(countResources("AWS::CloudFront::Distribution", 1));
	});
	it("it throws if you try to create a stack that is not in us-east-1", () => {
		const { stack: stackInWrongRegion } = new TestApp("us-west-1");
		const fn = (): void => {
			new DomainRedirect(stackInWrongRegion, "redirects", {
				zoneName: "domain1.com",
				cert: fakeCert,
				target: "https://spencerbeg.gs",
				preserve: false,
			});
		};
		expect(fn).toThrow(new Error(REGION_ERROR_MESSAGE));
	});
});
