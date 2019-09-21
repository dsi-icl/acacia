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

    it.only('admin can create projects (e2e)', function() {
        /* setup: login via API */
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);
        const studyId = '5f0e6362-e593-4d61-a2bc-73730d8933f6';
        cy.visit(`/datasets/${studyId}/projects`);

        /* clicking the create new user button to go to page */
        cy.get('[placeholder="Enter name"]', { timeout: 100000 }).type('newprojecttest', { force: true });
        // cy.contains('Add new project').click();
    });



    it.only('displays error message when creating new project if name is not provided (e2e)', function() {
        /* setup: login via API */
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);
        const studyId = '5f0e6362-e593-4d61-a2bc-73730d8933f6';
        cy.visit(`/datasets/${studyId}/projects`);

        /* error bar should not be visible */
        cy.contains('Add new project', { timeout: 100000 });   // making sure ajax is finished 
        cy.contains('Please enter project name.').should('not.exist');

        /* clicking the create new user button to go to page */
        cy.contains('Add new project').click();
        cy.contains('Please enter project name.').should('have.class', 'error_banner');
    });
});