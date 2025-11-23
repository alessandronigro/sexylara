import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../models/girlfriend.dart';
import '../services/girlfriend_service.dart';
import '../widgets/girlfriend_avatar.dart';

class GirlfriendProfileScreen extends StatefulWidget {
  final String girlfriendId;

  const GirlfriendProfileScreen({
    super.key,
    required this.girlfriendId,
  });

  @override
  State<GirlfriendProfileScreen> createState() => _GirlfriendProfileScreenState();
}

class _GirlfriendProfileScreenState extends State<GirlfriendProfileScreen> {
  final _girlfriendService = GirlfriendService();
  Girlfriend? _girlfriend;
  bool _loading = true;
  bool _regeneratingAvatar = false;

  @override
  void initState() {
    super.initState();
    _loadGirlfriend();
  }

  Future<void> _loadGirlfriend() async {
    setState(() => _loading = true);
    try {
      final girlfriend = await _girlfriendService.getGirlfriendById(widget.girlfriendId);
      setState(() {
        _girlfriend = girlfriend;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore caricamento profilo: $e')),
        );
      }
    }
  }

  Future<void> _regenerateAvatar() async {
    if (_girlfriend == null) return;

    setState(() => _regeneratingAvatar = true);
    
    try {
      final characteristics = {
        'age': _girlfriend!.age,
        'ethnicity': _girlfriend!.ethnicity,
        'bodyType': _girlfriend!.bodyType,
        'hairLength': _girlfriend!.hairLength,
        'hairColor': _girlfriend!.hairColor,
        'eyeColor': _girlfriend!.eyeColor,
        'personalityType': _girlfriend!.personalityType,
        'girlfriendId': _girlfriend!.id,
      };
      
      final newAvatarUrl = await _girlfriendService.generateAvatar(characteristics);
      
      // Aggiorna la girlfriend con il nuovo avatar
      final updatedGirlfriend = _girlfriend!.copyWith(avatarUrl: newAvatarUrl);
      await _girlfriendService.updateGirlfriend(updatedGirlfriend);
      
      setState(() {
        _girlfriend = updatedGirlfriend;
        _regeneratingAvatar = false;
      });
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Avatar rigenerato con successo! ✨')),
        );
      }
    } catch (e) {
      setState(() => _regeneratingAvatar = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore rigenerazione avatar: $e')),
        );
      }
    }
  }

  Future<void> _deleteGirlfriend() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1A),
        title: const Text('Elimina Girlfriend', style: TextStyle(color: Colors.white)),
        content: Text(
          'Sei sicuro di voler eliminare ${_girlfriend?.name}?\n\nQuesta azione eliminerà:\n• Il profilo\n• Tutti i messaggi\n• Tutte le foto generate\n• L\'avatar\n\nQuesta azione è irreversibile.',
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Annulla'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Elimina'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    try {
      await _girlfriendService.deleteGirlfriend(widget.girlfriendId);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Girlfriend eliminata')),
        );
        context.go('/'); // Torna alla home
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Errore eliminazione: $e')),
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
        title: Text(_girlfriend?.name ?? 'Profilo'),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_outline, color: Colors.red),
            onPressed: _deleteGirlfriend,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Colors.pinkAccent))
          : _girlfriend == null
              ? const Center(child: Text('Girlfriend non trovata', style: TextStyle(color: Colors.white)))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      // Avatar con pulsante rigenera
                      Stack(
                        alignment: Alignment.center,
                        children: [
                          GirlfriendAvatar(
                            girlfriend: _girlfriend,
                            radius: 80,
                          ),
                          if (_regeneratingAvatar)
                            Container(
                              width: 160,
                              height: 160,
                              decoration: BoxDecoration(
                                color: Colors.black54,
                                shape: BoxShape.circle,
                              ),
                              child: const Center(
                                child: CircularProgressIndicator(color: Colors.pinkAccent),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      
                      // Pulsante rigenera avatar
                      OutlinedButton.icon(
                        onPressed: _regeneratingAvatar ? null : _regenerateAvatar,
                        icon: const Icon(Icons.refresh),
                        label: Text(_regeneratingAvatar ? 'Generando...' : 'Rigenera Foto Profilo'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.pinkAccent,
                          side: const BorderSide(color: Colors.pinkAccent),
                        ),
                      ),
                      
                      const SizedBox(height: 32),
                      
                      // Informazioni
                      _buildInfoCard(),
                      
                      const SizedBox(height: 16),
                      
                      // Statistiche
                      _buildStatsCard(),
                      
                      const SizedBox(height: 32),
                      
                      // Pulsante elimina
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: _deleteGirlfriend,
                          icon: const Icon(Icons.delete_forever),
                          label: const Text('Elimina Girlfriend'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.red,
                            side: const BorderSide(color: Colors.red),
                            padding: const EdgeInsets.symmetric(vertical: 16),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }

  Widget _buildInfoCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Informazioni',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          _buildInfoRow('Nome', _girlfriend!.name),
          _buildInfoRow('Età', '${_girlfriend!.age} anni'),
          if (_girlfriend!.ethnicity != null)
            _buildInfoRow('Etnia', _girlfriend!.ethnicity!),
          if (_girlfriend!.bodyType != null)
            _buildInfoRow('Corpo', _girlfriend!.bodyType!),
          if (_girlfriend!.hairLength != null && _girlfriend!.hairColor != null)
            _buildInfoRow('Capelli', '${_girlfriend!.hairLength} ${_girlfriend!.hairColor}'),
          if (_girlfriend!.eyeColor != null)
            _buildInfoRow('Occhi', _girlfriend!.eyeColor!),
          if (_girlfriend!.heightCm != null)
            _buildInfoRow('Altezza', '${_girlfriend!.heightCm} cm'),
          if (_girlfriend!.personalityType != null)
            _buildInfoRow('Personalità', _girlfriend!.personalityType!),
          _buildInfoRow('Tono', _getToneName(_girlfriend!.tone)),
        ],
      ),
    );
  }

  Widget _buildStatsCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Statistiche',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildStatItem(Icons.message, 'Messaggi', '0'), // TODO: Implementa conteggio
              _buildStatItem(Icons.photo, 'Foto', '0'), // TODO: Implementa conteggio
              _buildStatItem(Icons.favorite, 'Preferita', 'No'), // TODO: Implementa preferiti
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(IconData icon, String label, String value) {
    return Column(
      children: [
        Icon(icon, color: Colors.pinkAccent, size: 32),
        const SizedBox(height: 8),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            color: Colors.grey[600],
            fontSize: 12,
          ),
        ),
      ],
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(color: Colors.grey[400], fontSize: 14),
          ),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  String _getToneName(String tone) {
    switch (tone) {
      case 'friendly':
        return 'Amichevole';
      case 'flirty':
        return 'Civettuola';
      case 'romantic':
        return 'Romantica';
      case 'explicit':
        return 'Esplicita';
      default:
        return tone;
    }
  }
}
