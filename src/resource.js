const _ = require('lodash');
const createError = require('http-errors');
const { ResourceServer } = require('@mtti/nats-rest');

class SequelizeResource {
  /**
   * Return a @mtti/microservice plugin which creates and starts a SequelizeResource for every
   * Sequelize model in the project with exportResource set to true.
   * @param {*} actions
   */
  static plugin(actions = {}) {
    return {
      init: (service) => {
        _.toPairs(service.models)
          .filter(pair => pair[1].exportResource === true)
          .map(pair => new SequelizeResource(
            service.natsClient,
            pair[1],
            { logger: service.logger, actions: actions[pair[0]]})
          )
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

    this._handlers = {};
    if (options.defaultHandlers !== false) {
      this._handlers = {
        GET: this._get.bind(this),
        PUT: this._put.bind(this),
        PATCH: this._patch.bind(this),
        DELETE: this._delete.bind(this),
      };
    }

    if (options.actions) {
      _.merge(this._handlers, options.actions);
    }
  }

  start() {
    this._server = new ResourceServer(this._natsClient, this._name, this._handlers, this._logger);

    this._model.hook('afterSave', (instance, options) => {
      this._server.emit(instance.toJSON());
    });
    this._model.hook('afterDestroy', (instance, options) => {

    });

    this._server.start();
  }

  _get(id) {
    if (id === null) {
      return Promise.reject(createError(404));
    }

    return this._model.findById(id)
      .then((instance) => {
        if (instance === null) {
          return createError(404);
        }
        return instance.toJSON();
      });
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

  _patch(id, body) {
    if (!id) {
      return Promise.reject(createError(405));
    }

    return this._model.findById(id)
      .then((instance) => {
        if (!instance) {
          return createError(404);
        }
        return instance.update(body);
      });
  }

  _delete(id) {
    if (!id) {
      return Promise.reject(createError(405));
    }
    return this._model.destroy({ where: { id }})
      .then(() => null);
  }
}

module.exports = SequelizeResource;
