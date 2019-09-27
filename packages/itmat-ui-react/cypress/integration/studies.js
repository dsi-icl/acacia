const { LOGIN_BODY_ADMIN } = require('../fixtures/loginstring');
const { CREATE_PROJECT, DELETE_PROJECT } = require('./study');
const { print } = require('graphql');

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
        cy.get('[placeholder="Enter name"]', { timeout: 100000 }).type('newprojecttest');
        cy.contains('Add new project').click();

        /* should have created new project and redirected */
        cy.url().then(url => {
            expect(url).to.match(new RegExp(`${Cypress.config().baseUrl}/datasets/${studyId}/projects/(\\w|-)+$`));
            cy.contains('newprojecttest');
            const listOfHeadingsTobeExpected = [
                'Role',
                'Patient ID Mapping',
                'Delete this project',
                'Granted Fields',
                'Granted Files'
            ];
            listOfHeadingsTobeExpected.forEach(el => {
                cy.get(`h5:contains(${el})`);
            });

            /* cleanup: delete the project */
            const projectId = url.substring(url.lastIndexOf('/') + 1);
            cy.request('POST', 'http://localhost:3003/graphql', { query: print(DELETE_PROJECT), variables: { projectId } })
                .its('body.data.deleteProject.successful').should('eq', true);
        });

    });



    it('displays error message when creating new project if name is not provided (e2e)', function() {
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

    it('admin can delete projects', function () {

    });
});