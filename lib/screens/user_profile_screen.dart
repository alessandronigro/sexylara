import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/supabase_service.dart';

class UserProfileScreen extends StatefulWidget {
  const UserProfileScreen({super.key});

  @override
  State<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends State<UserProfileScreen> {
  final _user = SupabaseService.currentUser;
  bool _loading = false;

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
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1A),
        title: const Text('Profilo'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _signOut,
            tooltip: 'Esci',
          ),
        ],
      ),
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
                        CircleAvatar(
                          radius: 50,
                          backgroundColor: Colors.pinkAccent,
                          child: Text(
                            _user?.email?.substring(0, 1).toUpperCase() ?? 'U',
                            style: const TextStyle(
                              fontSize: 40,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
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
                      _buildFeatureItem('👯 Companion illimitati'),
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
                        onTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Funzionalità in arrivo')),
                          );
                        },
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Sezione Utilizzo
                  _buildSection(
                    title: '📊 Utilizzo Mensile',
                    children: [
                      _buildUsageItem('Messaggi', 45, 100),
                      _buildUsageItem('Immagini', 12, 50),
                      _buildUsageItem('Video', 3, 10),
                      _buildUsageItem('Audio', 8, 30),
                    ],
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
                        onTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Funzionalità in arrivo')),
                          );
                        },
                      ),
                      _buildListTile(
                        icon: Icons.privacy_tip,
                        title: 'Privacy',
                        subtitle: 'Impostazioni privacy',
                        onTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Funzionalità in arrivo')),
                          );
                        },
                      ),
                      _buildListTile(
                        icon: Icons.help,
                        title: 'Aiuto e Supporto',
                        subtitle: 'FAQ e contatti',
                        onTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Funzionalità in arrivo')),
                          );
                        },
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

  Widget _buildUsageItem(String label, int used, int limit) {
    final percentage = (used / limit).clamp(0.0, 1.0);
    
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
                style: const TextStyle(color: Colors.white, fontSize: 14),
              ),
              Text(
                '$used / $limit',
                style: TextStyle(
                  color: Colors.grey[400],
                  fontSize: 12,
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
                percentage > 0.8 ? Colors.red : Colors.pinkAccent,
              ),
              minHeight: 6,
            ),
          ),
        ],
      ),
    );
  }
}
