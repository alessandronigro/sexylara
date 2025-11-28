import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';
import '../models/npc.dart';
import 'supabase_service.dart';

class NpcService {
  static final _supabase = SupabaseService.client;

  /// Get all npcs for current user
  Future<List<Npc>> getNpcs() async {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) return [];

    final response = await _supabase
        .from('npcs')
        .select()
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', ascending: false);

    return (response as List)
        .map((json) => Npc.fromJson(json))
        .toList();
  }

  /// Get single npc by ID
  Future<Npc?> getNpc(String id) async {
    final response = await _supabase
        .from('npcs')
        .select()
        .eq('id', id)
        .single();

    return Npc.fromJson(response);
  }

  /// Alias for getNpc to match UI usage
  Future<Npc?> getNpcById(String id) async {
    return await getNpc(id);
  }

  /// Create new npc
  Future<Npc> createNpc(Npc npc) async {
    final userId = SupabaseService.currentUser?.id;
    if (userId == null) throw Exception('User not authenticated');

    final data = npc.toJson();
    data['user_id'] = userId;

    final response = await _supabase
        .from('npcs')
        .insert(data)
        .select()
        .single();

    return Npc.fromJson(response);
  }

  /// Update existing npc
  Future<Npc> updateNpc(Npc npc) async {
    final response = await _supabase
        .from('npcs')
        .update(npc.toJson())
        .eq('id', npc.id)
        .select()
        .single();

    return Npc.fromJson(response);
  }

  /// Delete npc and all associated data
  Future<void> deleteNpc(String id) async {
    try {
      // Call backend API to delete npc and all files
      final response = await http.delete(
        Uri.parse('${Config.apiBaseUrl}/api/npcs/$id'),
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to delete npc: ${response.body}');
      }
    } catch (e) {
      print('Error deleting npc: $e');
      throw e;
    }
  }

  /// Generate avatar using Backend API
  Future<String> generateAvatar(Map<String, dynamic> characteristics) async {
    // Build prompt from characteristics
    final prompt = _buildPrompt(characteristics);
    
    try {
      print('🎨 Generating avatar with characteristics: $characteristics');
      final response = await http.post(
        Uri.parse('${Config.apiBaseUrl}/api/generate-avatar'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'prompt': prompt,
          'npcId': characteristics['npcId'],
        }),
      );

      print('📡 Avatar generation response status: ${response.statusCode}');
      print('📡 Avatar generation response body: ${response.body}');

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final avatarUrl = data['imageUrl'] as String;
        print('✅ Avatar URL generated: $avatarUrl');
        return avatarUrl;
      } else {
        throw Exception('Failed to generate avatar: ${response.body}');
      }
    } catch (e) {
      print('Error generating avatar: $e');
      // Fallback to placeholder if backend fails
      return 'https://via.placeholder.com/400';
    }
  }

  String _buildPrompt(Map<String, dynamic> char) {
    final parts = <String>[];

    // Base description
    parts.add('portrait photo of a beautiful');

    // Age
    if (char['age'] != null) {
      parts.add('${char['age']} year old');
    }

    // Height
    if (char['heightCm'] != null) {
      parts.add('${char['heightCm']} cm tall');
    }

    // Ethnicity
    if (char['ethnicity'] != null) {
      parts.add(char['ethnicity']);
    }

    // Gender and body type – explicit phrasing to avoid mixed gender visuals
    final gender = char['gender'] == 'male' ? 'male' : 'female';
    if (char['bodyType'] != null) {
      parts.add('$gender ${char['bodyType']} body');
    } else {
      parts.add('$gender body');
    }

    // Hair
    if (char['hairLength'] != null && char['hairColor'] != null) {
      parts.add('${char['hairLength']} ${char['hairColor']} hair');
    }

    // Eyes
    if (char['eyeColor'] != null) {
      parts.add('${char['eyeColor']} eyes');
    }

    // Personality expression
    if (char['personalityType'] != null) {
      parts.add('${char['personalityType']} expression');
    }

    // Tone
    if (char['tone'] != null) {
      parts.add('${char['tone']} tone');
    }

    // Final quality tags
    parts.add('professional photography, high quality, realistic, detailed face, soft lighting');

    return parts.join(', ');
  }

  /// Get all images from npc's gallery
  Future<List<String>> getNpcGallery(String npcId) async {
    try {
      final userId = SupabaseService.currentUser?.id;
      if (userId == null) return [];

      final response = await http.get(
        Uri.parse('${Config.apiBaseUrl}/api/npc-gallery/$userId/$npcId'),
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        return data.cast<String>();
      } else {
        throw Exception('Failed to load gallery: ${response.body}');
      }
    } catch (e) {
      print('Error loading gallery: $e');
      return [];
    }
  }
}
