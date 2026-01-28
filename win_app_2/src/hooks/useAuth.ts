import { useAuthStore } from '@/stores/authStore'
import * as authManager from '@/services/auth/authenticationManager'

export function useAuth() {
  const { authState, isAuthenticated, currentUser } = useAuthStore()

  return {
    authState,
    isAuthenticated,
    currentUser,
    checkExistingAuth: authManager.checkExistingAuth,
    loginWithCredentials: authManager.loginWithCredentials,
    registerWithCredentials: authManager.registerWithCredentials,
    startDeviceCodeFlow: authManager.startDeviceCodeFlow,
    cancelDeviceCodeFlow: authManager.cancelDeviceCodeFlow,
    loginWithGoogle: authManager.loginWithGoogle,
    logout: authManager.logoutUser,
  }
}
