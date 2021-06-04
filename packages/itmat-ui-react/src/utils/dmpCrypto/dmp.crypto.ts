import msrCrypto from './msrCrypto';

const selectCrypto = () => {
    const finalCrypto = window.crypto || msrCrypto;
    return finalCrypto;
};

export default selectCrypto();
