import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/splash_screen.dart';
import '../features/auth/onboarding_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/signup_screen.dart';
import '../features/auth/otp_screen.dart';
import '../features/module/module_select_screen.dart';
import '../navigation/sentry_nav.dart';
import '../navigation/adl_nav.dart';
import '../store/auth_store.dart';
import '../store/module_store.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authProvider);
  final activeModule = ref.watch(moduleProvider);

  return GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final loggedIn = auth.isLoggedIn;
      final onAuth = state.matchedLocation.startsWith('/auth') ||
                     state.matchedLocation == '/splash' ||
                     state.matchedLocation == '/onboarding';

      if (!loggedIn && !onAuth) return '/auth/login';
      if (loggedIn && onAuth)  return '/modules';
      return null;
    },
    routes: [
      GoRoute(path: '/splash',      builder: (c, s) => const SplashScreen()),
      GoRoute(path: '/onboarding',  builder: (c, s) => const OnboardingScreen()),
      GoRoute(path: '/auth/login',  builder: (c, s) => const LoginScreen()),
      GoRoute(path: '/auth/signup', builder: (c, s) => const SignUpScreen()),
      GoRoute(path: '/auth/otp',    builder: (c, s) => const OtpScreen()),
      GoRoute(path: '/modules',     builder: (c, s) => const ModuleSelectScreen()),
      GoRoute(path: '/sentry',      builder: (c, s) => const SentryNav()),
      GoRoute(path: '/adl',         builder: (c, s) => const AdlNav()),
    ],
  );
});
