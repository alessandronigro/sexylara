import 'dart:io';
import 'package:flutter/foundation.dart';

class Config {
  static String get _host {
    if (kIsWeb) return 'localhost';
    if (Platform.isAndroid) return '10.0.2.2';
    return 'localhost';
  }

  static String get apiBaseUrl {
    const envUrl = String.fromEnvironment('BACKEND_BASE_URL');
    if (envUrl.isNotEmpty) return envUrl;
    return 'http://$_host:4000';
  }

  static String get aiServiceUrl {
    const envUrl = String.fromEnvironment('AI_SERVICE_URL');
    if (envUrl.isNotEmpty) return envUrl;

    return 'http://$_host:5001';
  }

  static String get wsBaseUrl {
    const envUrl = String.fromEnvironment('WS_BASE_URL');
    if (envUrl.isNotEmpty) return envUrl;
    
    return Platform.isAndroid 
        ? 'ws://10.0.2.2:5001'
        : 'ws://localhost:5001';
  }
}
