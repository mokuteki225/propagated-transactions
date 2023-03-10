const assert = require('node:assert');
const { describe, it, before, afterEach, after } = require('node:test');

const { TransactionError } = require('#root/lib/transaction-error.js');
const { knex, KnexTransactionRunner, data } = require('#test/fixtures.js');
const { IsolatedTransaction } = require('#root/lib/isolated-transaction.js');

describe('IsolatedTransaction', async () => {
  before(async () => {
    await knex.schema.dropTableIfExists('user');
    await knex.schema.createTable('user', (table) => {
      table.integer('id');
      table.string('name');
      table.string('surname');
    });
  });

  afterEach(async () => {
    await knex('user').del();
  });

  after(() => {
    process.exit(0);
  });

  it('Successfully create user inside of knex transaction', async () => {
    const isolatedTransaction = new IsolatedTransaction(KnexTransactionRunner);

    const connection = await isolatedTransaction.start();

    const callback = async () => {
      try {
        const user = await isolatedTransaction
          .connection('user')
          .insert(data.user);

        await isolatedTransaction.commit();
      } catch (err) {
        await isolatedTransaction.rollback();
      }
    };

    await isolatedTransaction.run(connection, callback);

    const selected = await knex
      .select('id', 'name', 'surname')
      .from('user')
      .where('id', data.user.id)
      .first();

    assert.deepEqual(selected, data.user);
  });

  it('Rollback after creating the user inside of knex transaction', async () => {
    const isolatedTransaction = new IsolatedTransaction(KnexTransactionRunner);

    const connection = await isolatedTransaction.start();

    const callback = async () => {
      const user = await isolatedTransaction
        .connection('user')
        .insert(data.user);

      await isolatedTransaction.rollback();
    };

    await isolatedTransaction.run(connection, callback);

    const selected = await knex
      .select('id', 'name', 'surname')
      .from('user')
      .where('id', data.user.id)
      .first();

    assert.deepEqual(selected, undefined);
  });

  it('Throw TransactionError.NotInContext when calling .commit() outside of the context', async () => {
    const isolatedTransaction = new IsolatedTransaction(KnexTransactionRunner);

    const handler = async () => {
      await isolatedTransaction.commit();
    };

    assert.rejects(handler, TransactionError.NotInContext());
  });

  it('Throw TransactionError.NotInContext when calling .rollback() outside of the context', async () => {
    const isolatedTransaction = new IsolatedTransaction(KnexTransactionRunner);

    const handler = async () => {
      await isolatedTransaction.rollback();
    };

    assert.rejects(handler, TransactionError.NotInContext());
  });
});
