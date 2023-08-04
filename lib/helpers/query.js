
module.exports = class Query {
  constructor (sql, bindings) {
    this.text = sql
    this.values = bindings
  }

  static fromString (sqlString, values) {
    return new Query(sqlString, values)
  }

  static fromKnexQuery (knexQuery) {
    const { sql, bindings } = knexQuery.toSQL().toNative()
    return new Query(sql, bindings)
  }

  toString () {
    return JSON.stringify({ text: this.text, values: this.values })
  }
}
