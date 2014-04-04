var Q = require("q");

var RexsterClient = require("./rexster");

module.exports = TitanClient = (function(){
  /**
   * A Class describing the behavior of Mogwai when interacting with a Titan
   * server.
   *
   * @param {Mogwai} mogwai
   */
  function TitanClient(mogwai) {
    RexsterClient.apply(this, arguments); // Call parent constructor
  }

  // Inherit from RexsterClient
  TitanClient.prototype = Object.create(RexsterClient.prototype);
  TitanClient.prototype.constructor = TitanClient;

  /**
   * Asynchronously build Titan types, used for indexing
   * Tested with Titan v0.4.0
   *
   * Loop through each schemas, find keys flagged for indexation, and build
   * types/indexes accordingly.
   *
   * This method does not recreate indexes on already created keys.
   *
   * Note: as per Titan's current limitations, "key index must be created prior
   * to key being used".
   *
   * @link https://github.com/thinkaurelius/titan/wiki/Type-Definition-Overview
   * @link https://github.com/thinkaurelius/titan/wiki/Titan-Limitations#temporary-limitations
   *
   * @param {Function} callback
   */
  TitanClient.prototype.createIndexes = function(callback) {
    this.getExistingTypes()
    .then(function(response) {
      alreadyIndexedKeys = response.results;
      return this.buildMakeKeyPromise(alreadyIndexedKeys);
    }.bind(this))
    .done(function(success) {
      callback(null, success);
    });
  };

  /**
   * Retrieves an array of names of already indexed keys.
   *
   * @return {Promise}
   */
  TitanClient.prototype.getExistingTypes = function() {
    var gremlin = this.mogwai.connection.grex.gremlin();

    return gremlin.g.getIndexedKeys("Vertex.class").exec();
  };

  /**
   * Create data types which Titan uses for indexing.
   *
   * Note that the Mogwai special "$type" key is automatically indexed.
   *
   * This method does not return promise of creation for already created types.
   *
   * @return {Promise} to create all keys
   */
  TitanClient.prototype.buildMakeKeyPromise = function(alreadyIndexedKeys) {
    var promises = [],
        g = this.mogwai.connection.grex,
        models = this.mogwai.models,
        schemaProperties,
        property,
        titanKey;

    var gremlin = this.mogwai.connection.grex.gremlin();

    // Make sure we index the Mogwai special $type key used for binding a model type to a vertex.
    if (alreadyIndexedKeys.indexOf("$type") === -1) {
      gremlin.g.makeKey("$type").dataType("String.class").indexed("Vertex.class").make();
    }

    // Also index keys defined for each model, but skip already indexed keys
    for (var i in models) {
      schemaProperties = models[i].schema.properties;

      for (var propertyName in schemaProperties) {
        // Only index keys that were not indexed before, skip otherwise
        if (alreadyIndexedKeys.indexOf(propertyName) === -1) {
          property = schemaProperties[propertyName];

          titanKey = gremlin.g.makeKey(propertyName).dataType(property.getDataType()).indexed("Vertex.class");

          if (property.isUnique()) {
            titanKey.unique();
          }

          titanKey.make();
        }
      }
    }

    var promise = gremlin.exec();

    return promise;
  };


  return TitanClient;

})();
