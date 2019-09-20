const { LOGIN_BODY_ADMIN } = require('../fixtures/loginstring');

describe('Studies page', function() {
    it('admin gets studies successfully', function() {
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);
        cy.visit('/datasets');
        cy.contains('UKBIOBANK', { timeout: 100000 });
        cy.contains('Past Jobs');
        cy.contains('Date');
        cy.contains('Type');
        cy.contains('Status');
        cy.contains('Metadata');
    });
});