import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/session_provider.dart';
import '../services/supabase_service.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _handleRegister() async {
    print('***** REGISTER BUTTON CLICKED');
    final name = _nameController.text.trim();
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;

    print('***** Email: $email, Password length: ${password.length}');

    if (name.isEmpty || email.isEmpty || password.isEmpty || confirmPassword.isEmpty) {
      print('***** ERROR: Empty fields');
      setState(() {
        _error = 'Compila tutti i campi (nome incluso)';
      });
      return;
    }

    if (password != confirmPassword) {
      print('***** ERROR: Passwords do not match');
      setState(() {
        _error = 'Le password non corrispondono';
      });
      return;
    }

    if (password.length < 6) {
      print('***** ERROR: Password too short');
      setState(() {
        _error = 'La password deve essere di almeno 6 caratteri';
      });
      return;
    }

    print('***** Starting registration...');
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      print('***** Calling Supabase signUp');
      final resp = await SupabaseService.client.auth.signUp(
        email: email,
        password: password,
      );

      final userId = resp.user?.id;
      if (userId != null) {
        try {
          await SupabaseService.client.from('user_profile').upsert({
            'id': userId,
            'username': name,
          });
        } catch (profileErr) {
          print('***** ERROR saving profile name: $profileErr');
        }
      }
      
      print('***** Registration successful');
      if (mounted) {
        // Mostra messaggio di successo
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Registrazione completata! Controlla la tua email per confermare.'),
            backgroundColor: Colors.green,
          ),
        );
        // Torna alla login
        context.go('/login');
      }
    } catch (error) {
      print('***** ERROR during registration: $error');
      setState(() {
        _error = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _handleGoogleSignIn() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final resp = await SupabaseService.instance.signInWithGoogle();
      final user = resp.user ?? resp.session?.user ?? SupabaseService.currentUser;
      if (user != null) {
        final metadata = user.userMetadata ?? {};
        final avatar = metadata['avatar_url'] ?? metadata['picture'];
        final username = metadata['full_name'] ??
            metadata['name'] ??
            user.email?.split('@')[0] ??
            'User';
        try {
          await SupabaseService.client.from('user_profile').upsert({
            'id': user.id,
            if (avatar != null) 'avatar_url': avatar,
            'username': username,
          });
        } catch (e) {
          debugPrint('Error saving Google profile on register: $e');
        }
      }
      await ref.read(sessionProvider.notifier).refresh();
      if (mounted) {
        context.go('/');
      }
    } catch (error) {
      setState(() {
        _error = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF2E0219), // Dark Purple/Red
              Color(0xFF000000), // Black
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Image.asset(
                    'assets/icon.png',
                    width: 100,
                    height: 100,
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Registrati',
                    style: Theme.of(context).textTheme.displayMedium?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Unisciti a ThrilMe',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: Colors.white70,
                        ),
                  ),
                  const SizedBox(height: 16),
                  const SizedBox(height: 48),
                  _buildTextField(
                    controller: _nameController,
                    label: 'Nome',
                    icon: Icons.person_outline,
                    keyboardType: TextInputType.name,
                  ),
                  const SizedBox(height: 16),
                  _buildTextField(
                    controller: _emailController,
                    label: 'Email',
                    icon: Icons.email_outlined,
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: 16),
                  _buildTextField(
                    controller: _passwordController,
                    label: 'Password',
                    icon: Icons.lock_outline,
                    obscureText: true,
                  ),
                  const SizedBox(height: 16),
                  _buildTextField(
                    controller: _confirmPasswordController,
                    label: 'Conferma Password',
                    icon: Icons.lock_outline,
                    obscureText: true,
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 24),
                    Text(
                      _error!,
                      style: const TextStyle(
                        color: Colors.redAccent,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: _loading ? null : _handleRegister,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.pinkAccent,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 5,
                      ),
                      child: _loading
                          ? const CircularProgressIndicator(color: Colors.white)
                          : const Text(
                              'REGISTRATI',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Row(
                    children: [
                      Expanded(child: Divider(color: Colors.white24)),
                      Padding(
                        padding: EdgeInsets.symmetric(horizontal: 16),
                        child: Text('OPPURE', style: TextStyle(color: Colors.white54, fontSize: 12)),
                      ),
                      Expanded(child: Divider(color: Colors.white24)),
                    ],
                  ),
                  const SizedBox(height: 24),
                  _buildSocialButton(
                    label: 'Registrati con Google',
                    icon: Icons.g_mobiledata,
                    color: Colors.white,
                    textColor: Colors.black,
                    onPressed: _loading ? null : _handleGoogleSignIn,
                  ),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
                        'Hai già un account? ',
                        style: TextStyle(color: Colors.white70),
                      ),
                      TextButton(
                        onPressed: () => context.go('/login'),
                        child: const Text(
                          'Accedi',
                          style: TextStyle(
                            color: Colors.pinkAccent,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    bool obscureText = false,
    TextInputType? keyboardType,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: Colors.white60),
        prefixIcon: Icon(icon, color: Colors.pinkAccent),
        filled: true,
        fillColor: Colors.white.withValues(alpha: 0.1),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.pinkAccent),
        ),
      ),
    );
  }

  Widget _buildSocialButton({
    required String label,
    required IconData icon,
    required Color color,
    required Color textColor,
    required VoidCallback? onPressed,
  }) {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: ElevatedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, color: textColor),
        label: Text(label, style: TextStyle(color: textColor, fontWeight: FontWeight.bold)),
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }
}
