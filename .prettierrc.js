module.exports = {
	useTabs: true,
	tabWidth: 2,
	trailingComma: "es5",
	printWidth: 125,
	overrides: [
		{
			files: ".prettierrc",
			options: { parser: "json" },
		},
	],
};
