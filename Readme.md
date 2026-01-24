## Source code of [iOrient - Competition map](https://run-balkan.com) web-site

#### Install locally for development
```cmd
git clone https://github.com/Boogier/RunBalkan.git
cd RunBalkan
npm install
```

#### Create a dummy `secrets.js` file:
```cmd
cp src/secrets.js.template src/secrets.js
```

#### Run dev server:
```cmd
npm start
```

#### Build production
```cmd
set NODE_ENV=production
npm run build
```
Some features require keys stored in src/secrets.js. 
