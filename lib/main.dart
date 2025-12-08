import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'screens/privacy_settings_screen.dart';
import 'screens/notification_settings_screen.dart';
import 'screens/support_screen.dart';
import 'screens/payment_methods_screen.dart';

import 'providers/session_provider.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/forgot_password_screen.dart';
import 'screens/contacts_screen.dart';
import 'screens/create_npc_screen.dart';
import 'screens/chat_screen.dart';
import 'screens/npc_gallery_screen.dart';
import 'screens/npc_profile_screen.dart';
import 'screens/user_profile_screen.dart';
import 'screens/preference_screen.dart';
import 'screens/subscription_screen.dart';
import 'screens/payment_success_screen.dart';
import 'screens/discover_contacts_screen.dart';
import 'screens/group_list_screen.dart';
import 'screens/create_group_screen.dart';
import 'screens/group_chat_screen.dart';
import 'services/supabase_service.dart';
import 'services/notification_service.dart';
import 'services/random_message_service.dart';
import 'screens/splash_screen.dart';
import 'screens/public_feed_screen.dart';


Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Use clean URLs on web (no #/login)
  if (kIsWeb) {
    usePathUrlStrategy();
  }
  await SupabaseService.initialize();
  await NotificationService().initialize();

  // Start random message service if user is logged in
  if (SupabaseService.currentUser != null) {
    RandomMessageService().start();
  }

  runApp(const ProviderScope(child: ThrilMeApp()));
}

class ThrilMeApp extends ConsumerWidget {
  const ThrilMeApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);

    final router = GoRouter(
      initialLocation: '/splash',
      redirect: (context, state) {
        const authFlow = ['/login', '/register', '/splash', '/forgot-password'];
        final isAuthFlow = authFlow.contains(state.location);
        if (!session.authenticated && !isAuthFlow) {
          return '/login';
        }
        if (session.authenticated &&
            (state.location == '/login' || state.location == '/register')) {
          return '/';
        }
        return null;
      },
      routes: [
        GoRoute(
            path: '/splash', builder: (context, state) => const SplashScreen()),
        GoRoute(
            path: '/login', builder: (context, state) => const LoginScreen()),
        GoRoute(
            path: '/register',
            builder: (context, state) => const RegisterScreen()),
        GoRoute(
            path: '/forgot-password',
            builder: (context, state) => const ForgotPasswordScreen()),
        GoRoute(path: '/', builder: (context, state) => const ContactsScreen()),
        GoRoute(path: '/contacts', builder: (context, state) => const ContactsScreen()),
        GoRoute(
            path: '/create-npc',
            builder: (context, state) => const CreateNpcScreen()),
        GoRoute(
          path: '/chat/:npcId',
          builder: (context, state) {
            final npcId = state.pathParameters['npcId']!;
            return ChatScreen(npcId: npcId);
          },
        ),
        GoRoute(
          path: '/gallery/:npcId',
          builder: (context, state) {
            final npcId = state.pathParameters['npcId']!;
            return NpcGalleryScreen(npcId: npcId);
          },
        ),
        GoRoute(
          path: '/profile/:npcId',
          builder: (context, state) {
            final npcId = state.pathParameters['npcId']!;
            return NpcProfileScreen(npcId: npcId);
          },
        ),
        GoRoute(
            path: '/preferenze',
            builder: (context, state) => const PreferenceScreen()),
        GoRoute(
            path: '/user-profile',
            builder: (context, state) => const UserProfileScreen()),
        GoRoute(
            path: '/subscription',
            builder: (context, state) => const SubscriptionScreen()),
        GoRoute(
          path: '/success',
          builder: (context, state) => PaymentSuccessScreen(
              success: state.queryParameters['success'] == 'true'),
        ),
        GoRoute(
            path: '/groups',
            builder: (context, state) => const GroupListScreen()),
        GoRoute(
            path: '/groups/create',
            builder: (context, state) => const CreateGroupScreen()),
        GoRoute(
          path: '/groups/:groupId',
          builder: (context, state) {
            final groupId = state.pathParameters['groupId']!;
            return GroupChatScreen(groupId: groupId);
          },
        ),
        GoRoute(
            path: '/feed',
            builder: (context, state) => const PublicFeedScreen()),
        GoRoute(
            path: '/discover-contacts',
            builder: (context, state) {
              final initialTab = state.queryParameters['initialTab'];
              return DiscoverContactsScreen(initialTab: initialTab);
            }),
        // New settings pages
        GoRoute(
          path: '/privacy',
          builder: (context, state) => const PrivacySettingsScreen()),
        GoRoute(
          path: '/notifications',
          builder: (context, state) => const NotificationSettingsScreen()),
        GoRoute(
          path: '/support',
          builder: (context, state) => const SupportScreen()),
        GoRoute(
          path: '/payment-methods',
          builder: (context, state) => const PaymentMethodsScreen()),
      ],
    );

    return MaterialApp.router(
      routerConfig: router,
      title: 'ThrilMe',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF1A1A1A),
          elevation: 0,
          iconTheme: IconThemeData(color: Colors.white),
          titleTextStyle: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w600),
          toolbarTextStyle: TextStyle(color: Colors.white),
        ),
      ),
    );
  }
}
