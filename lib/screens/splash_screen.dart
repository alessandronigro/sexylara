import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/session_provider.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _logoPulse;
  Timer? _navigationTimer;

  @override
  void initState() {
    super.initState();
    _logoPulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);

    _navigationTimer = Timer(const Duration(seconds: 2), _navigateNext);
  }

  @override
  void dispose() {
    _logoPulse.dispose();
    _navigationTimer?.cancel();
    super.dispose();
  }

  void _navigateNext() {
    if (!mounted) return;
    final session = ref.read(sessionProvider);
    final target = session.authenticated ? '/' : '/login';
    final router = GoRouter.of(context);
    if (router.location == '/splash') {
      router.go(target);
    } else if (router.location == '/login' || router.location == '/') {
      // Already redirected externally (hot reload) - no-op.
    } else {
      router.go(target);
    }
  }

  @override
  Widget build(BuildContext context) {
    final accent = Colors.pinkAccent;
    return Scaffold(
      backgroundColor: Colors.black,
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF1B0020), Color(0xFF000000)],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedBuilder(
                  animation: _logoPulse,
                  builder: (context, child) {
                    final value = 0.9 + _logoPulse.value * 0.2; // 0.9 to 1.1 scale
                    return Transform.scale(
                      scale: value,
                      child: child,
                    );
                  },
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Container(
                        width: 240,
                        height: 240,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: RadialGradient(
                            colors: [
                              accent.withOpacity(0.05),
                              Colors.transparent
                            ],
                          ),
                        ),
                      ),
                      Container(
                        width: 180,
                        height: 180,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: accent,
                          boxShadow: [
                            BoxShadow(
                              color: accent.withOpacity(0.8),
                              blurRadius: 30,
                              spreadRadius: 8,
                            ),
                          ],
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(30.0),
                          child: Image.asset(
                            'assets/icon.png',
                            fit: BoxFit.contain,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 32),
                Text(
                  'ThrilMe',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        color: Colors.white,
                        letterSpacing: 1.5,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Talk. Connect. Feel.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.white70,
                        fontSize: 14,
                      ),
                ),
                const SizedBox(height: 48),
                SizedBox(
                  width: 220,
                  child: LinearProgressIndicator(
                    valueColor: AlwaysStoppedAnimation(accent),
                    backgroundColor: Colors.white10,
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Caricamento in corso…',
                  style: TextStyle(color: Colors.white70),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
