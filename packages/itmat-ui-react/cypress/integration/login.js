describe('Login test', () => {
    it('fails to login with wrong password', () => {
        cy.visit('/');
        cy.get('#username_input').type('chon.sou');
        cy.get('#password_input').type('wrongpassword');
        cy.get('#loginButton').click();
        cy.contains('Incorrect password.');
    });

    it('fails to login with wrong username', () => {
        cy.visit('/');
        cy.get('#username_input').type('nobody');
        cy.get('#password_input').type('wrongpassword');
        cy.get('#loginButton').click();
        cy.contains('User does not exist.');
    });

    it('logs in successfully', () => {
        cy.visit('/');
        cy.get('#username_input').type('chon.sou');
        cy.get('#password_input').type('admin');
        cy.get('#loginButton').click();
        // TO_DO: add snapshot
    });
});
