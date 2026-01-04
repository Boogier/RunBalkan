[![tests status](https://github.com/wladich/nakarte/workflows/check/badge.svg)](https://github.com/wladich/nakarte/actions?query=workflow%3Atest)

Source code of Run-Balkan web-site

Install locally for development

```bash
git clone https://github.com/Boogier/nakarte.git
cd nakarte
yarn
```

Create a dummy `secrets.js` file:
```bash
cp src/secrets.js.template src/secrets.js
```

Run dev server:
```bash
npm start
```

Some features require keys stored in src/secrets.js. 
