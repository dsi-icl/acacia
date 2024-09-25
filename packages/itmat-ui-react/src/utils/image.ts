import { IUserWithoutToken } from '@itmat-broker/itmat-types';

export const createUserIcon = (user: IUserWithoutToken) => {
    const { firstname, lastname } = user;
    // Utility function to extract initials
    const getInitials = (firstname, lastname) => {
        const firstInitial = firstname ? firstname.charAt(0).toUpperCase() : '';
        const lastInitial = lastname ? lastname.charAt(0).toUpperCase() : '';

        if (firstInitial && lastInitial) {
            return `${firstInitial}${lastInitial}`;
        } else if (firstInitial) {
            return firstInitial;
        } else if (lastInitial) {
            return lastInitial;
        } else {
            return 'NN'; // Default initials when both names are empty
        }
    };

    // Utility function to generate a random color
    const getRandomColor = () => {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    };

    // Generate initials and background color
    const initials = getInitials(firstname, lastname);
    const backgroundColor = getRandomColor();

    // Create a canvas element to render the initials image
    const canvas = document.createElement('canvas');
    const size = 100; // Define a size for the image
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
        // Draw the background color
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, size, size);

        // Draw the initials
        ctx.fillStyle = 'white';
        ctx.font = 'bold 50px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials, size / 2, size / 2);
    }

    // Convert canvas to data URL
    const dataURL = canvas.toDataURL();

    // Return the Ant Design Image component with the generated data URL
    return dataURL;
};

