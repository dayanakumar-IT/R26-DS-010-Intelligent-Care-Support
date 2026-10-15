import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import '../core/config/api_config.dart';

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

  Future<String?> signIn(String email, String password) async {
    try {
      final uri = Uri.parse('${ApiConfig.baseUrl}/api/auth/login');
      final response = await http.post(uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'password': password}),
      ).timeout(const Duration(seconds: 15));
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode != 200) return body['detail'] as String? ?? 'Login failed.';
      state = state.copyWith(
        isLoggedIn:    true,
        caregiverId:   body['user_id'] as String?,
        caregiverName: body['name'] as String?,
        token:         body['access_token'] as String?,
        role:          body['role'] as String?,
      );
      return null;
    } catch (e) { return 'Connection error: $e'; }
  }

  Future<void> signOut() async {
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
