import 'package:flutter_riverpod/flutter_riverpod.dart';

class AuthState {
  final bool isLoggedIn;
  final String? caregiverId;
  final String? caregiverName;
  final String? token;

  const AuthState({
    this.isLoggedIn = false,
    this.caregiverId,
    this.caregiverName,
    this.token,
  });

  AuthState copyWith({
    bool? isLoggedIn,
    String? caregiverId,
    String? caregiverName,
    String? token,
  }) {
    return AuthState(
      isLoggedIn:    isLoggedIn    ?? this.isLoggedIn,
      caregiverId:   caregiverId   ?? this.caregiverId,
      caregiverName: caregiverName ?? this.caregiverName,
      token:         token         ?? this.token,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(const AuthState());

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

  void logout() {
    state = const AuthState();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(
  (ref) => AuthNotifier(),
);
