module.exports = {
	parser: "@typescript-eslint/parser", // Specifies the ESLint parser
	plugins: ["@typescript-eslint"],
	extends: [
		"plugin:@typescript-eslint/recommended", // Uses the recommended rules from the @typescript-eslint/eslint-plugin
		"prettier/@typescript-eslint", // Uses eslint-config-prettier to disable ESLint rules from @typescript-eslint/eslint-plugin that would conflict with prettier
		"plugin:prettier/recommended", // Enables eslint-plugin-prettier and displays prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
	],
	parserOptions: {
		ecmaVersion: 2018, // Allows for the parsing of modern ECMAScript features
		sourceType: "module", // Allows for the use of imports
		ecmaFeatures: {
			modules: true,
		},
	},
	env: {
		node: true,
		jest: true,
	},
	settings: {
		"import/extensions": [".js", ".jsx", ".ts", ".tsx"],
		"import/parsers": {
			"@typescript-eslint/parser": [".ts", ".tsx"],
		},
		"import/resolver": {
			typescript: {
				directory: "./tsconfig.json",
			},
			node: {
				extensions: [".js", ".jsx", ".ts", ".tsx"],
			},
		},
	},
	rules: {
		"sort-imports": [
			"error",
			{
				ignoreCase: false,
				ignoreDeclarationSort: false,
				ignoreMemberSort: false,
				memberSyntaxSortOrder: ["none", "all", "multiple", "single"],
			},
		],
		"max-len": [
			"warn",
			{
				code: 125,
				ignoreRegExpLiterals: true,
				ignoreTemplateLiterals: true,
				ignoreStrings: true,
				ignoreUrls: true,
			},
		],
		"no-unused-vars": [
			"error",
			{
				vars: "all",
				args: "after-used",
				ignoreRestSiblings: true,
				argsIgnorePattern: "err",
			},
		],
	},
};
