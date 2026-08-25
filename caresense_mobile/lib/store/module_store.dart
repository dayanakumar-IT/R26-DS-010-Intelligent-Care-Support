import 'package:flutter_riverpod/flutter_riverpod.dart';

enum ActiveModule { sentry, scribe }

class ModuleNotifier extends StateNotifier<ActiveModule> {
  ModuleNotifier() : super(ActiveModule.sentry);
  void switchTo(ActiveModule module) => state = module;
}

final moduleProvider = StateNotifierProvider<ModuleNotifier, ActiveModule>(
  (ref) => ModuleNotifier(),
);
