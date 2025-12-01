import 'dart:convert';
import 'dart:io';
import 'package:image_picker/image_picker.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/supabase_service.dart';
import '../services/user_usage_service.dart';
import '../services/user_service.dart';
import '../widgets/main_top_bar.dart';

class UserProfileScreen extends StatefulWidget {
  const UserProfileScreen({super.key});

  @override
  State<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends State<UserProfileScreen> {
  final _user = SupabaseService.currentUser;
  bool _loading = false;
  bool _profileLoading = true;
  bool _savingProfile = false;
  final _nameController = TextEditingController();
  bool _isPublic = false;
  String? _avatarUrl;
  Map<String, int> _usage = {
    'messages': 0,
    'images': 0,
    'video': 0,
    'audio': 0,
  };

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _loadUsage();
  }

  Future<void> _loadProfile() async {
    final userService = UserService(userId: _user?.id ?? '');
    try {
      final profile = await userService.fetchUserProfile();
      if (mounted) {
        setState(() {
          _nameController.text = profile['username'] ?? profile['name'] ?? (_user?.email?.split('@').first ?? '');
          _isPublic = profile['is_public'] == true;
          _avatarUrl = profile['avatar_url'];
          _profileLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _profileLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore caricamento profilo: $e')),
        );
      }
    }
  }

  Future<void> _saveProfile() async {
    final displayName = _nameController.text.trim();
    if (displayName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Inserisci un nome visibile')),
      );
      return;
    }
    setState(() => _savingProfile = true);
    final userService = UserService(userId: _user?.id ?? '');
    try {
      await userService.updateUserProfile(displayName: displayName, isPublic: _isPublic);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profilo aggiornato')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore salvataggio: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _savingProfile = false);
    }
  }

  Future<void> _pickAndUploadAvatar() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 800,
      maxHeight: 800,
      imageQuality: 80,
    );
    
    if (file == null) return;

    setState(() => _savingProfile = true);
    try {
      final bytes = await file.readAsBytes();
      final base64Image = base64Encode(bytes);
      
      final userService = UserService(userId: _user?.id ?? '');
      final newUrl = await userService.updateUserAvatar(base64Image);
      
      if (mounted) {
        setState(() {
          _avatarUrl = newUrl;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Avatar aggiornato')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore caricamento avatar: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _savingProfile = false);
    }
  }

  Future<void> _loadUsage() async {
    if (_user == null) return;
    final usage = await UserUsageService.getMonthlyUsage(_user!.id);
    if (mounted) {
      setState(() {
        _usage = usage;
      });
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _signOut() async {
    setState(() => _loading = true);
    try {
      await SupabaseService.instance.signOut();
      if (mounted) {
        context.go('/login');
      }
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore logout: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      appBar: const MainTopBar(active: MainTopBarSection.profile),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Colors.pinkAccent))
          : SingleChildScrollView(
              child: Column(
                children: [
                  // Header con avatar e info utente
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          Colors.pinkAccent.withOpacity(0.2),
                          Colors.purpleAccent.withOpacity(0.1),
                        ],
                      ),
                    ),
                    child: Column(
                      children: [
                        GestureDetector(
                          onTap: _savingProfile ? null : _pickAndUploadAvatar,
                          child: Stack(
                            children: [
                              CircleAvatar(
                                radius: 50,
                                backgroundColor: Colors.pinkAccent,
                                backgroundImage: _avatarUrl != null ? NetworkImage(_avatarUrl!) : null,
                                child: _avatarUrl == null
                                    ? Text(
                                        _user?.email?.substring(0, 1).toUpperCase() ?? 'U',
                                        style: const TextStyle(
                                          fontSize: 40,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.white,
                                        ),
                                      )
                                    : null,
                              ),
                              Positioned(
                                bottom: 0,
                                right: 0,
                                child: Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: const BoxDecoration(
                                    color: Colors.white,
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.camera_alt,
                                    size: 20,
                                    color: Colors.pinkAccent,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: _savingProfile ? null : _pickAndUploadAvatar,
                          child: const Text(
                            'Cambia foto',
                            style: TextStyle(color: Colors.white70),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          _user?.email ?? 'Utente',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.pinkAccent.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Text(
                            'Piano Free',
                            style: TextStyle(
                              color: Colors.pinkAccent,
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Sezione profilo pubblico
                  _buildSection(
                    title: '🙋‍♂️ Visibilità profilo',
                    children: [
                      TextField(
                        controller: _nameController,
                        enabled: !_savingProfile && !_profileLoading,
                        style: const TextStyle(color: Colors.white),
                        decoration: InputDecoration(
                          labelText: 'Nome visibile',
                          labelStyle: TextStyle(color: Colors.grey[400]),
                          filled: true,
                          fillColor: const Color(0xFF1E1E1E),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      SwitchListTile(
                        value: _isPublic,
                        onChanged: _savingProfile || _profileLoading
                            ? null
                            : (val) => setState(() => _isPublic = val),
                        title: const Text('Profilo pubblico', style: TextStyle(color: Colors.white)),
                        subtitle: const Text(
                          'Se attivo, altri utenti possono invitarti come Thriller.',
                          style: TextStyle(color: Colors.grey),
                        ),
                        activeColor: Colors.pinkAccent,
                        tileColor: const Color(0xFF1E1E1E),
                      ),
                      const SizedBox(height: 12),
                      ElevatedButton.icon(
                        onPressed: _savingProfile || _profileLoading ? null : _saveProfile,
                        icon: _savingProfile
                            ? const SizedBox(
                                height: 16,
                                width: 16,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.save),
                        label: Text(_savingProfile ? 'Salvataggio...' : 'Salva'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.pinkAccent,
                          foregroundColor: Colors.white,
                          minimumSize: const Size.fromHeight(44),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Sezione Abbonamento
                  _buildSection(
                    title: '💎 Abbonamento Premium',
                    children: [
                      _buildListTile(
                        icon: Icons.star,
                        title: 'Passa a Premium',
                        subtitle: 'Sblocca tutte le funzionalità',
                        onTap: () => context.push('/subscription'),
                        trailing: const Icon(Icons.arrow_forward_ios, size: 16, color: Colors.pinkAccent),
                      ),
                      _buildFeatureItem('✨ Messaggi illimitati'),
                      _buildFeatureItem('🎨 Generazione immagini illimitata'),
                      _buildFeatureItem('🎬 Generazione video illimitata'),
                      _buildFeatureItem('🎙️ Messaggi vocali illimitati'),
                      _buildFeatureItem('👯 Thrillers illimitati'),
                      _buildFeatureItem('🎭 Personalizzazione avanzata'),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Sezione Metodo di Pagamento
                  _buildSection(
                    title: '💳 Metodo di Pagamento',
                    children: [
                      _buildListTile(
                        icon: Icons.credit_card,
                        title: 'Gestisci pagamenti',
                        subtitle: 'Aggiungi o modifica carte',
                        onTap: () => context.push('/payment-methods'),
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Sezione Utilizzo
                  // Sezione Utilizzo
                  _buildSection(
                    title: '📊 Utilizzo Mensile',
                    children: [
                      _buildUsageItem('Messaggi', _usage['messages']!, UserUsageService.limitMessages),
                      _buildUsageItem('Immagini', _usage['images']!, UserUsageService.limitImages),
                      _buildUsageItem('Video', _usage['video']!, UserUsageService.limitVideo),
                      _buildUsageItem('Audio', _usage['audio']!, UserUsageService.limitAudio),
                    ],
                  ),

                  if (_isAnyLimitReached())
                    Container(
                      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.red.withOpacity(0.1),
                        border: Border.all(color: Colors.redAccent),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        children: [
                          const Icon(Icons.block, color: Colors.redAccent, size: 40),
                          const SizedBox(height: 8),
                          const Text(
                            'Limite Raggiunto',
                            style: TextStyle(
                              color: Colors.redAccent,
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Hai raggiunto il limite del tuo piano Free. Passa a Premium per continuare senza limiti.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.white70),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.redAccent,
                              foregroundColor: Colors.white,
                            ),
                            onPressed: () => context.push('/subscription'),
                            child: const Text('Sblocca ora'),
                          ),
                        ],
                      ),
                    ),

                  const SizedBox(height: 16),

                  // Sezione Impostazioni
                  _buildSection(
                    title: '⚙️ Impostazioni',
                    children: [
                      _buildListTile(
                        icon: Icons.notifications,
                        title: 'Notifiche',
                        subtitle: 'Gestisci le notifiche',
                        onTap: () => context.push('/notifications'),
                      ),
                      _buildListTile(
                        icon: Icons.privacy_tip,
                        title: 'Privacy',
                        subtitle: 'Impostazioni privacy',
                        onTap: () => context.push('/privacy'),
                      ),
                      _buildListTile(
                        icon: Icons.help,
                        title: 'Aiuto e Supporto',
                        subtitle: 'FAQ e contatti',
                        onTap: () => context.push('/support'),
                      ),
                    ],
                  ),

                  const SizedBox(height: 32),

                  // Pulsante Esci
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: OutlinedButton.icon(
                      onPressed: _signOut,
                      icon: const Icon(Icons.logout),
                      label: const Text('Esci dall\'app'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.red,
                        side: const BorderSide(color: Colors.red),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        minimumSize: const Size(double.infinity, 50),
                      ),
                    ),
                  ),

                  const SizedBox(height: 32),

                  // Footer
                  Text(
                    'ThrilMe v1.0.0',
                    style: TextStyle(
                      color: Colors.grey[600],
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }

  Widget _buildSection({required String title, required List<Widget> children}) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          ...children,
        ],
      ),
    );
  }

  Widget _buildListTile({
    required IconData icon,
    required String title,
    String? subtitle,
    VoidCallback? onTap,
    Widget? trailing,
  }) {
    return ListTile(
      leading: Icon(icon, color: Colors.pinkAccent),
      title: Text(
        title,
        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500),
      ),
      subtitle: subtitle != null
          ? Text(subtitle, style: TextStyle(color: Colors.grey[400], fontSize: 12))
          : null,
      trailing: trailing,
      onTap: onTap,
    );
  }

  Widget _buildFeatureItem(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Row(
        children: [
          const SizedBox(width: 40),
          Text(
            text,
            style: TextStyle(
              color: Colors.grey[300],
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  bool _isAnyLimitReached() {
    return _usage['messages']! >= UserUsageService.limitMessages ||
        _usage['images']! >= UserUsageService.limitImages ||
        _usage['video']! >= UserUsageService.limitVideo ||
        _usage['audio']! >= UserUsageService.limitAudio;
  }

  Widget _buildUsageItem(String label, int used, int limit) {
    final percentage = (used / limit).clamp(0.0, 1.0);
    final isLimitReached = used >= limit;
    
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: isLimitReached ? Colors.redAccent : Colors.white,
                  fontSize: 14,
                  fontWeight: isLimitReached ? FontWeight.bold : FontWeight.normal,
                ),
              ),
              Text(
                '$used / $limit',
                style: TextStyle(
                  color: isLimitReached ? Colors.redAccent : Colors.grey[400],
                  fontSize: 12,
                  fontWeight: isLimitReached ? FontWeight.bold : FontWeight.normal,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: percentage,
              backgroundColor: Colors.grey[800],
              valueColor: AlwaysStoppedAnimation<Color>(
                isLimitReached ? Colors.red : (percentage > 0.8 ? Colors.orange : Colors.pinkAccent),
              ),
              minHeight: 6,
            ),
          ),
        ],
      ),
    );
  }
}
