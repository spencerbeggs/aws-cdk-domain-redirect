module.exports = {
	root: true,
	parser: "@typescript-eslint/parser",
	plugins: ["@typescript-eslint"],
	extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier", "prettier/@typescript-eslint"],
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: "module",
	},
	env: {
		node: true,
		es6: true,
	},
	globals: {},
	rules: {
		semi: ["error", "always"],
		quotes: ["error", "double"],
		"@typescript-eslint/explicit-function-return-type": "off",
		"@typescript-eslint/no-explicit-any": 1,
		"@typescript-eslint/no-var-requires": 0,
		"@typescript-eslint/no-inferrable-types": [
			"warn",
			{
				ignoreParameters: true,
			},
		],
		"@typescript-eslint/no-unused-vars": "warn",
	},
};
