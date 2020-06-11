import 'cypress-file-upload';

Cypress.Commands.add('form_request', (url, formData) => {
    return cy
        .server()
        .route('POST', url)
        .as('formRequest')
        .window()
        .then(win => {
            var xhr = new win.XMLHttpRequest();
            xhr.open('POST', url);
            xhr.withCredentials = true;
            xhr.send(formData);
        })
        .wait('@formRequest');
});
