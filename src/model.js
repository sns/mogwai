var Model,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) {
    for (var key in parent) {
      if (__hasProp.call(parent, key)) child[key] = parent[key];
    }

    function ctor() {
      this.constructor = child;
    }

    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
    child.__super__ = parent.prototype;
    return child;
  };


module.exports = Model = (function() {

  function Model() {
    this.schema = null;
  }

  Model.prototype.exec = function(grexQuery, callback) {
    console.log("Grex:", grexQuery.params);
    grexQuery.then(function(success) {
      return callback(null, success);
    }).fail(function(err) {
      console.log(err);
      return callback(err);
    });
  };


  /*
   * Insert a document, or update if already present (checks the vertex _id)
  */
  Model.prototype.save = function(callback) {
    if (this._id !== null) {
      // Vertex already exist, just update it
      return this.update(callback);
    } else {
      // Missing, insert a new vertex
      var doc = this;
      doc.type = this.type;
      return this.insert(doc, callback);
    }
  };


  /*
    Update current Vertex
  */
  Model.prototype.update = function(callback) {
    // WARN (TODO/check): The following query may be vulnerable to a Gremlin 'SQL' injection attack
    var query;

    query = this.g.v(this._id)._().sideEffect('{it.name="' + this.name + '"; it.description="' + this.description + '"}');
    return this.exec(query, callback);
  };

  /*
    Insert a new Vertex with given doc properties
  */


  Model.prototype.insert = function(doc, callback) {
    var query, trxn;

    trxn = this.g.begin();
    trxn.addVertex(doc);
    query = trxn.commit();

    return this.exec(query, callback);
  };


  /*
    Executes a Gremlin (grex) query, and return results as raw documents or models.

    TODO: improve performance when fetching only one document (check condition and remove loop).

    @param grexQuery {Function} grex query to execute
    @param asModel {Boolean} Whether retrieve each document as raw document or as a model instance (defaults to true)
  */
  Model.find = function(grexQuery, asModel, callback) {
    if (typeof grexQuery !== "object" || typeof grexQuery === null) {
      return callback("You must provide a valid Gremlin query");
    }

    console.log("Grex:", grexQuery.params);
    if (typeof asModel === "function") {
      callback = asModel;
      asModel = true;
    }

    var self = this;

    grexQuery
    .then(function(success) {
      if (success.results.length === 0 ) {
        return callback(null, null);
      }

      if (!asModel) {
        // Return raw results
        return callback(null, success.results);
      }

      // Return all vertices/documents as model instances
      var doc, key, result, results = [];
      for (var i = 0, _len = success.results.length; i < _len; i++) {
        result = success.results[i];
        doc = new self();
        for (key in result) {
          doc[key] = result[key];
        }
        results.push(doc);
      }

      return callback(null, results);
    })
    .fail(function(err) {
      return callback(err);
    });
  };


  /*
    Find a Vertex by name
  */
  Model.findOne = function(field, callback) {
    var key = Object.keys(field)[0];
    var query = this.g.V(key, field[key]).index(0);

    this.find(query, function(err, results) {
      return callback(err, results[0]);
    });
  };


  /*
    Find a Vertex by ID
  */
  Model.findById = function(id, callback) {
    var query = this.g.v(id);

    this.find(query, function(err, results) {
      return callback(err, results[0]);
    });
  };


  /*
    Delete a Vertex by ID.
  */
  Model.delete = function(id, callback) {
    this.g.removeVertex(g.v(id))
    .then(function(result) {
      return callback(null, result);
    })
    .fail(function(err) {
      return callback(err);
    });
  };


  /*
    Dynamically build an instantiable model class

    @inspiredBy: https://github.com/LearnBoost/mongoose/blob/a04860f30f03c44029ea64ec2b08e723e6baf899/lib/model.js#L2454

    @return {Class}
  */
  Model.compile = function(name, schema, base) {
    console.log("-- Compiling Model: "+name);

    model = (function(_super) {
      __extends(model, _super);
      function model() {
        return model.__super__.constructor.apply(this, arguments);
      }

      // Bind grex client to model as g property
      // We're doing so because models are usually compiled *before* the connection is fully established (grex connects async).
      model.__defineGetter__("g", function(){
        return base.connection.grex;
      });

      model.prototype.__defineGetter__("g", function() {
        return base.connection.grex;
      })

      // Define vertex _type as model's name. This could be improved.
      model.prototype.type = name.toLowerCase();

      return model;

    })(Model);

    // Add instance methods
    for (var fnName in schema.methods) {
      model.prototype[fnName] = schema.methods[fnName];
    }

    // Add class methods
    for (var fnName in schema.statics) {
      model[fnName] = schema.statics[fnName];
    }

    model.schema = model.prototype.schema;

    console.log("-- Done compiling --\n");

    return model;
  };



  return Model;

})();
