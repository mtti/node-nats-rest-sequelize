Publish [Sequelize](http://docs.sequelizejs.com/) models RESTfully over (NATS)[https://nats.io]. Expands upon my [nats-rest](https://www.npmjs.com/package/@mtti/nats-rest) library which implements a storage-independent RESTful API over NATS.

## Example

```javascript
// server.js

const nats = require('nats');
const Sequelize = require('sequelize');
const { SequelizeResource } = require('@mtti/nats-rest-sequelize');

const natsClient = nats.connect({servers: ['nats://localhost:4222']});

const sequelize = new Sequelize('postgres://user:pass@localhost:5432/dbname');
const Document = sequelize.define('document', {
    id: {
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
    },
    title: {
        type: Sequelize.TEXT,
    },
    body: {
        type: Sequelize.TEXT,
    },
});

const documentServer = new SequelizeResource(natsClient, Document);

sequelize.sync()
    .then(() => {
        documentServer.start();
    });
```
