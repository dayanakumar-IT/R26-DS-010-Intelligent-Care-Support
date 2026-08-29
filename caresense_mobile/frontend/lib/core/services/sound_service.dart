// Conditional export: uses Web Audio API on Chrome, no-op stub elsewhere
export 'sound_service_stub.dart'
    if (dart.library.html) 'sound_service_web.dart';
