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

    this._collectionActions = {};
    this._instanceActions = {};

    if (options.defaultHandlers !== false) {
      this._instanceActions = {
        GET: this._get.bind(this),
        PUT: this._put.bind(this),
        PATCH: this._patch.bind(this),
        DELETE: this._delete.bind(this),
      };
    }

    if (this._model.collectionActions) {
      _.merge(this._collectionActions, this._model.collectionActions);
    }
    if (this._model.instanceActions) {
      const wrappedInstanceActions = _.fromPairs(
        _.toPairs(this._model.instanceActions)
          .map(pair => [pair[0], this._wrapInstanceAction(pair[1])])
      );
      _.merge(this._instanceActions, wrappedInstanceActions);
    }
  }

  start() {
    const serverOptions = {
      collectionActions: this._collectionActions,
      instanceActions: this._instanceActions,
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

  /**
   * Wrap an instance action callback so that the instance it's targeting is automatically loaded
   * and passed to the callback instead of the ID.
   */
  _wrapInstanceAction(action) {
    return (id, body) => {
      return this._model.findById(id)
        .then((instance) => {
          if (instance === null) {
            return Promise.reject(createError(404));
          }
          return action(instance, body);
        });
    }
  }
}

module.exports = SequelizeResource;
