![status alpha](https://img.shields.io/badge/development_status-alpha-red.svg)
[![npm version](https://badge.fury.io/js/%40mtti%2Fnats-rest-sequelize.svg)](https://badge.fury.io/js/%40mtti%2Fnats-rest-sequelize)

Publish [Sequelize](http://docs.sequelizejs.com/) models RESTfully over [NATS](https://nats.io). Expands upon my [nats-rest](https://www.npmjs.com/package/@mtti/nats-rest) library which implements a storage-independent RESTful API over NATS.

## Caveats

* The primary key of every model must be called `id`.

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
