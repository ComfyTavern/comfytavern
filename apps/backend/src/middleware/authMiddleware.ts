import { Elysia, type Context as ElysiaContext } from 'elysia';
import { AuthService } from '../services/AuthService';
import type { UserContext, DefaultUserIdentity, AuthenticatedMultiUserIdentity } from '@comfytavern/types';

export interface AuthContext {
  userContext: UserContext | null;
  authError: { message: string; name?: string; stack?: string } | null;
}

export function applyAuthMiddleware(app: Elysia): Elysia {
  app
    .decorate('AuthService', AuthService)
    .derive(async (elysiaCtx: ElysiaContext & { store: any; AuthService: typeof AuthService }) => {
      const { request, AuthService: AuthServiceFromCtx } = elysiaCtx;
      let derivedUserContext: UserContext | null = null;
      let derivedAuthError: Error | null = null; // Internal variable to track errors
      let derivedAuthErrorInfo: AuthContext['authError'] = null;

      try {
        const authorizationHeader = request.headers.get('Authorization');
        if (authorizationHeader && authorizationHeader.toLowerCase().startsWith('bearer ')) {
          const apiKeySecret = authorizationHeader.substring(7);
          const authenticatedUserIdentity = await AuthServiceFromCtx.authenticateViaApiKey(apiKeySecret);
          
          if (authenticatedUserIdentity) {
            // TODO: Refine UserContext creation based on the specific API key authenticated identity
            // For now, fetching generic context or assuming API key implies a certain user context.
            derivedUserContext = await AuthServiceFromCtx.getUserContext(elysiaCtx); 
          } else {
            // API Key provided but authentication failed or not fully implemented.
            // If API key auth were mandatory and failed, we might set derivedAuthError here.
            // Example: derivedAuthError = new Error("Invalid API Key");
            // This would then be handled by the error processing logic below.
          }
        }

        // If no user context from API key auth, and no error explicitly set by API key auth failure
        if (!derivedUserContext && !derivedAuthError) { 
          derivedUserContext = await AuthServiceFromCtx.getUserContext(elysiaCtx);
        }

      } catch (error) {
        // Catch errors from AuthService.getUserContext or other await calls within the try block
        derivedAuthError = error instanceof Error ? error : new Error(String(error));
        derivedAuthErrorInfo = { message: derivedAuthError.message, name: derivedAuthError.name, stack: derivedAuthError.stack };
      }
      
      // If, after all attempts, user context is still null, and no specific error was processed by the catch block
      // (or if derivedAuthError was set by non-throwing API key logic)
      if (!derivedUserContext && !derivedAuthError) {
        const err = new Error('User context could not be determined by the authentication middleware.');
        // derivedAuthError = err; // Update internal error state
        derivedAuthErrorInfo = { message: err.message, name: err.name, stack: err.stack }; 
      } else if (derivedAuthError && !derivedAuthErrorInfo) {
        // This ensures that if derivedAuthError was set (e.g., by a non-throwing API key failure path)
        // but not processed by the catch block, derivedAuthErrorInfo is still populated.
        derivedAuthErrorInfo = { message: derivedAuthError.message, name: derivedAuthError.name, stack: derivedAuthError.stack };
      }
      
      return { userContext: derivedUserContext, authError: derivedAuthErrorInfo };
    });
  return app;
}