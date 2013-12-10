module.exports = Client = (function () {
  /**
   * The main abstract Client class.
   *
   * @param {Mogwai} mogwai - An instance of Mogwai
   */
  function Client(mogwai) {
    this.mogwai = mogwai;

    this.g = this.mogwai.connection.g;
    this.graph = this.mogwai.connection.graph;
  }

  return Client;

})();
