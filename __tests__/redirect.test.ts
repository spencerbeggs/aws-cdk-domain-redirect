import { makeRedirect } from "../src/redirect";
describe("makeRedirect", () => {
	const event = {
		Records: [
			{
				cf: {
					request: {
						uri: "/pathname",
						querystring: "foo=bar",
					},
					response: {
						headers: {},
					},
				},
			},
		],
	};
	const context = {};
	let callback: jest.Mock;
	beforeAll(() => {
		callback = jest.fn();
	});
	it("it redirects to a target, stripping path and query string", () => {
		const func = eval(makeRedirect("https://target.com"));
		func(event, context, callback);
		expect(callback).toHaveBeenCalledWith(
			null,
			expect.objectContaining({
				status: "301",
				headers: {
					location: [
						{
							key: "Location",
							value: "https://target.com",
						},
					],
				},
			}),
		);
	});
	it("it redirects, preserving the pathname", () => {
		const func = eval(makeRedirect("https://target.com", true));
		func(event, context, callback);
		expect(callback).toHaveBeenCalledWith(
			null,
			expect.objectContaining({
				status: "301",
				headers: {
					location: [
						{
							key: "Location",
							value: "https://target.com/pathname",
						},
					],
				},
			}),
		);
	});
	it("it redirects, preserving the query", () => {
		const func = eval(makeRedirect("https://target.com", false, true));
		func(event, context, callback);
		expect(callback).toHaveBeenCalledWith(
			null,
			expect.objectContaining({
				status: "301",
				headers: {
					location: [
						{
							key: "Location",
							value: "https://target.com?foo=bar",
						},
					],
				},
			}),
		);
	});
	it("it redirects, preserving the pathname and query", () => {
		const func = eval(makeRedirect("https://target.com", true, true));
		func(event, context, callback);
		expect(callback).toHaveBeenCalledWith(
			null,
			expect.objectContaining({
				status: "301",
				headers: {
					location: [
						{
							key: "Location",
							value: "https://target.com/pathname?foo=bar",
						},
					],
				},
			}),
		);
	});
});
