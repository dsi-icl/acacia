import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { trpc } from '../../../utils/trpc';
import LoadSpinner from '../loadSpinner';// Adjust path based on your existing component
import { IUserWithoutToken } from '@itmat-broker/itmat-types';

interface ProtectedRouteProps {
    /** Array of user types that should be restricted */
    restrictedUserTypes?: string[];
    /** Array of role names that should be restricted */
    restrictedRoles?: string[];
    /** Path to redirect to when access is denied */
    redirectPath?: string;
    /** Custom validation function for complex rules */
    customValidator?: (user: IUserWithoutToken) => boolean;
    /** Show loading spinner while checking permissions */
    showLoadingSpinner?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    restrictedUserTypes = ['GUEST'],
    redirectPath = '/datasets', // Changed from '/access-denied' to '/datasets'
    customValidator,
    showLoadingSpinner = true
}) => {
    const location = useLocation();
    const { data: user, isLoading, isError } = trpc.user.whoAmI.useQuery();

    // Show loading spinner while fetching user data
    if (isLoading && showLoadingSpinner) {
        return <LoadSpinner />;
    }

    // Redirect to login if user is not authenticated
    if (isError || !user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Check if user type is restricted
    const isRestrictedUserType = restrictedUserTypes.includes(user.type);


    // Apply custom validation if provided
    const failsCustomValidation = customValidator ? !customValidator(user) : false;

    // If user should be restricted, redirect them to datasets
    if (isRestrictedUserType || failsCustomValidation) {
        return (
            <Navigate
                to={redirectPath}
                state={{
                    from: location,
                    redirected: true,
                    reason: 'guest_restriction'
                }}
                replace
            />
        );
    }

    // User has access, render the protected content
    return <Outlet />;
};