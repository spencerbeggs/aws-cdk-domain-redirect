# aws-cdk-domain-redirect

[![Build Status](https://travis-ci.org/spencerbeggs/aws-cdk-domain-redirect.svg?branch=master)](https://travis-ci.org/spencerbeggs/aws-cdk-domain-redirect) [![Coverage Status](https://coveralls.io/repos/github/spencerbeggs/aws-cdk-domain-redirect/badge.svg?branch=master)](https://coveralls.io/github/spencerbeggs/aws-cdk-domain-redirect?branch=master) [![Known Vulnerabilities](https://snyk.io/test/github/spencerbeggs/aws-lambda-cors/badge.svg)](https://snyk.io/test/github/spencerbeggs/aws-cdk-domain-redirect)

[Route 53](https://aws.amazon.com/route53/) is one of the cheapest, powerful and most flexible domain registrar and DNS provider around. And yet, there's no straightforward way to just redirect one domain to another like GoDaddy's trusty old [domain forwarding](https://www.godaddy.com/help/forward-my-domain-12123) feature. AWS Support [offers a lackluster solution](https://aws.amazon.com/premiumsupport/knowledge-center/redirect-domain-route-53/) to the problem, which is to enable website hosting in S3 and redirect using bucket properties. But this prevents your site from using HTTPS — and who doesn't use HTTPS nowadays?

It turns out that setting up proper domain fowrarding on AWS involves a mess of CloudFront distributions, Lambda@Edge functions and Route 53 Alias records. Who has time for all that?

If you are using [AWS Cloud Development Kit](https://aws.amazon.com/cdk/) to manage your infrastructure, this construct will wire it all together for your in just a couple lines of code. Note: Lambda@Edge functions must be created in the us-east-1 region, which means that [a stack using this constuct does too](https://github.com/spencerbeggs/aws-cdk-domain-redirect/issues/1).

## Basic Usage

By default, this module just needs:

1. the name of your hosted zone, e.g., `source.com`
2. the ARN of a Certificate Manager certificate that supports your alias, by default `{zoneName}` and `www.{zoneNane}`
3. the target URL you want to redirect traffic to

```typescript
import { App, Stack, StackProps } from "@aws-cdk/core";
import { DomainRedirect } from "@spencerbeggs/aws-cdk-domain-redirect";

export class MyStack extends Stack {
	public constructor(scope: App, id: string, props?: StackProps) {
		super(scope, id, props);
		new DomainRedirect(this, "MyRedirects", {
			zoneName: "source.com",
			cert: "arn:aws:acm:us-east-1:62638843746:certificate/29789573-2b30-469f-cf...",
			target: "https://target.com",
		});
	}
}
```

You can also pass and array of options objects as the construct props if you want to setup fowrarding for multiple zones and configurations. Passing an array reduces the number of resources in your final template compared to instantiating multiple instances.

### Advanced Usage

The configuration above is going to 301 redirect traffic from `http(s)://source.com` and `http(s)://source.com` to `https://target.com`. If you want to redirect domains other that the apex and www subdomain, just pass them as an array in the `hostnames` property:

```typescript
new DomainRedirect(this, "MyRedirects", {
	zoneName: "source.com",
	cert: "arn:aws:acm:us-east-1:62638843746:certificate/29789573-2b30-469f-cf...",
	target: "https://target.com",
	hostnames: ["foo.source.com", "bar.source.com"],
});
```

The default configuration will preserve the request pathname and querystring when redirecting to the target. You can selectively control this behavior with the `preserve` property:

```typescript
new DomainRedirect(this, "MyRedirects", {
	zoneName: "source.com",
	cert: "arn:aws:acm:us-east-1:62638843746:certificate/29789573-2b30-469f-cf...",
	target: "https://target.com",
	// you can also disable both with preserve: false
	preserve: {
		path: true,
		query: false,
	},
});
```

You can also pass a [Certificate construct](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-certificatemanager.Certificate.html) as the cert property. The zoneName property can also be a [HostedZone construct](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-route53.HostedZone.html) or an [IHostedZone](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-route53.IHostedZone.html), just be aware that [you need to look them up by zoneName](https://github.com/aws/aws-cdk/issues/6232). Types are bundled with the module.
