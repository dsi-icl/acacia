export interface UserID {
    id: string;
    username: string;
}

export const printDebug = (
    elem: Element | null,
    message: string,
    data: string
): void => {
    if (elem) {
        elem.innerHTML = `<b>${message}:</b><pre>${data}</pre>`;
    }
};
