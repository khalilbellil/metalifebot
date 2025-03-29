const { lang } = require('./config.json');
const locales = require(`./locales/${lang}.json`);

module.exports = {
	lang: lang,
	getLocale(key, variables = []) {
		const template = locales[key] || `[TRANSLATION MISSING: ${key}]`;
		return template.replace(/\$(\d+)/g, (_, index) => {
			const idx = parseInt(index) - 1;
			return variables[idx] !== undefined ? variables[idx] : `[MISSING VAR ${index}]`;
		});
	},
};