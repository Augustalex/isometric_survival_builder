const Express = require('express');

const app = Express();
app.use(Express.static('./'));
app.listen(3000, () => {
    console.log('Server running on port 3000');
});