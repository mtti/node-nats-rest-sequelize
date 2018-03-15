const _ = require('lodash');
const createError = require('http-errors');
const { ResourceServer, InstanceAction } = require('@mtti/nats-rest');

class SequelizeResource {
  /**
   * Return a @mtti/microservice plugin which creates and starts a SequelizeResource for every
   * Sequelize model in the project with exportResource set to true.
   * @param {*} actions
   */
  static plugin() {
    return {
      init: (service) => {
        _.toPairs(service.models)
          .filter(pair => pair[1].exportResource === true)
          .map(pair => new SequelizeResource(
            service.natsClient,
            pair[1],
            { logger: service.logger }
          ))
          .forEach((resource) => {
            resource.start();
          });
      }
    }
  }

  constructor(natsClient, model, options = {}) {
    this._natsClient = natsClient;
    this._model = model;
    this._name = options.name || model.name;

    if (options.logger) {
      this._logger = options.logger;
    }

    this._defaultBodySchema = this._model.defaultBodySchema;
    this._jsonValidation = this._model.jsonValidation || 'permissive';
    this._jsonSchemas = this._model.jsonSchemas || {};
    this._actions = [];

    if (options.defaultActions !== false) {
      if (this._jsonValidation === 'strict' && !this._defaultBodySchema) {
        throw new Error('defaultBodySchema is required with defaultActions and strict validation');
      }

      const getAction = new InstanceAction('GET', this._get.bind(this));
      const putAction = new InstanceAction('PUT', this._put.bind(this))
        .setLoadInstance(false)
        .setBodySchema(this._defaultBodySchema);
      const patchAction = new InstanceAction('PATCH', this._patch.bind(this))
        .setBodySchema(this._defaultBodySchema);
      const deleteAction = new InstanceAction('DELETE', this._delete.bind(this))
        .setLoadInstance(false);

      Array.prototype.push.apply(this._actions, [
        getAction,
        putAction,
        patchAction,
        deleteAction,
      ]);
    }

    if (this._model.actions) {
      Array.prototype.push.apply(this._actions, this._model.actions);
    }
  }

  start() {
    const serverOptions = {
      instanceLoader: this._instanceLoader.bind(this),
      jsonValidation: this._jsonValidation,
      jsonSchemas: this._jsonSchemas,
      actions: this._actions,
      logger: this._logger,
    };
    this._server = new ResourceServer(this._natsClient, this._name, serverOptions);

    this._model.hook('afterSave', (instance, options) => {
      this._server.emit(instance.toJSON());
    });
    this._model.hook('afterDestroy', (instance, options) => {

    });

    this._server.start();
  }

  _instanceLoader(id) {
    return this._model.findById(id)
      .then((instance) => {
        if (!instance) {
          throw createError(404);
        }
        return instance;
      });
  }

  _get(instance) {
    return instance.toJSON();
  }

  _put(id, body) {
    let bodyCopy = {};
    if (body) {
      bodyCopy = _.cloneDeep(body);
    }

    if (id) {
      bodyCopy.id = id;
    }

    const instance = this._model.build(bodyCopy);
    return instance.save();
  }

  _patch(instance, body) {
    return instance.update(body);
  }

  _delete(id) {
    if (!id) {
      return Promise.reject(createError(405));
    }
    return this._model.destroy({ where: { id }})
      .then(() => ({ result: 'OK' }));
  }
}

module.exports = SequelizeResource;
