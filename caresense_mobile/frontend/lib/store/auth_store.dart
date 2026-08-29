import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AuthState {
  final bool isLoggedIn;
  final String? caregiverId;
  final String? caregiverName;
  final String? token;
  final String? role;

  const AuthState({
    this.isLoggedIn = false,
    this.caregiverId,
    this.caregiverName,
    this.token,
    this.role,
  });

  AuthState copyWith({
    bool? isLoggedIn,
    String? caregiverId,
    String? caregiverName,
    String? token,
    String? role,
  }) {
    return AuthState(
      isLoggedIn:    isLoggedIn    ?? this.isLoggedIn,
      caregiverId:   caregiverId   ?? this.caregiverId,
      caregiverName: caregiverName ?? this.caregiverName,
      token:         token         ?? this.token,
      role:          role          ?? this.role,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(const AuthState());

  /// Sign in with Supabase - checks profiles table for caregiver role.
  Future<String?> signIn(String email, String password) async {
    try {
      final response = await Supabase.instance.client.auth
          .signInWithPassword(email: email, password: password);

      final user = response.user;
      if (user == null) return 'Login failed - no user returned.';

      // Fetch profile to get name and role
      final profile = await Supabase.instance.client
          .from('profiles')
          .select('name, role')
          .eq('id', user.id)
          .maybeSingle();

      if (profile == null) return 'Profile not found. Contact your supervisor.';

      final role = profile['role'] as String? ?? '';
      if (role != 'caregiver' && role != 'admin' && role != 'supervisor') {
        await Supabase.instance.client.auth.signOut();
        return 'Access denied. This app is for caregivers only.';
      }

      state = state.copyWith(
        isLoggedIn:    true,
        caregiverId:   user.id,
        caregiverName: profile['name'] as String? ?? email,
        token:         response.session?.accessToken,
        role:          role,
      );
      return null; // null = success
    } on AuthException catch (e) {
      return e.message;
    } catch (e) {
      return 'Connection error. Check your network.';
    }
  }

  Future<void> signOut() async {
    await Supabase.instance.client.auth.signOut();
    state = const AuthState();
  }

  // Keep for mock compatibility during development
  void login({
    required String caregiverId,
    required String caregiverName,
    required String token,
  }) {
    state = state.copyWith(
      isLoggedIn:    true,
      caregiverId:   caregiverId,
      caregiverName: caregiverName,
      token:         token,
    );
  }

  void logout() => state = const AuthState();
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(
  (ref) => AuthNotifier(),
);
