import 'dart:io';
import 'package:flutter/foundation.dart';

class Config {
  static String get _host {
    if (kIsWeb) return 'localhost';
    if (Platform.isAndroid) return '192.168.1.42'; // Local dev machine IP
    return 'localhost';
  }

  static String get apiBaseUrl {
    const envUrl = String.fromEnvironment('BACKEND_BASE_URL');
    if (envUrl.isNotEmpty) return envUrl;
    if (kReleaseMode) {
      const prodUrl = String.fromEnvironment('PROD_BACKEND_URL');
      if (prodUrl.isNotEmpty) return prodUrl;
      return 'https://myvps.example.com:4001'; // replace with real VPS URL
    }
    return 'http://$_host:4001';
  }

  static String get aiServiceUrl {
    const envUrl = String.fromEnvironment('AI_SERVICE_URL');
    if (envUrl.isNotEmpty) return envUrl;
    if (kReleaseMode) {
      const prodUrl = String.fromEnvironment('PROD_AI_URL');
      if (prodUrl.isNotEmpty) return prodUrl;
      return 'https://myvps.example.com:4001';
    }
    return 'http://$_host:4001';
  }

  static String get wsBaseUrl {
    const envUrl = String.fromEnvironment('WS_BASE_URL');
    if (envUrl.isNotEmpty) return envUrl;
    if (kReleaseMode) {
      const prodUrl = String.fromEnvironment('PROD_WS_URL');
      if (prodUrl.isNotEmpty) return prodUrl;
      return 'wss://myvps.example.com:5001';
    }
    return 'ws://$_host:5001';
  }
}
