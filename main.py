from flask import Flask, render_template, request, jsonify
import json
import os
import logging
import shutil
from datetime import datetime
from functools import wraps
from typing import Dict, Any, List, Optional, Tuple

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask('SafeRoute')

MAPS_DIR = 'maps'
BACKUPS_DIR = os.path.join(MAPS_DIR, 'backups')
TEMP_FILE = os.path.join(MAPS_DIR, 'temp_changes.json')
VERSIONS_FILE = os.path.join(MAPS_DIR, 'versions.json')
DEFAULT_MAP_FILE = os.path.join(MAPS_DIR, 'default.json')
DEFAULT_MAP_STRUCTURE = {'markers': [], 'polygons': []}


class StorageManager:
    
    @staticmethod
    def load_json(filepath: str, default_value: Any) -> Any:
        try:
            if not os.path.exists(filepath):
                logger.warning(f"Файл не існує: {filepath}, створюємо новий")
                StorageManager.save_json(filepath, default_value)
                return default_value
            
            if os.path.getsize(filepath) == 0:
                logger.warning(f"Файл порожній: {filepath}, відновлюємо")
                StorageManager.save_json(filepath, default_value)
                return default_value
            
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
                
        except json.JSONDecodeError as e:
            logger.error(f"Помилка JSON в {filepath}: {e}")
            StorageManager.save_json(filepath, default_value)
            return default_value
            
        except Exception as e:
            logger.error(f"Непередбачена помилка при читанні {filepath}: {e}")
            return default_value
    
    @staticmethod
    def save_json(filepath: str, data: Any) -> bool:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            logger.error(f"Помилка збереження {filepath}: {e}")
            return False
    
    @staticmethod
    def initialize():
        os.makedirs(MAPS_DIR, exist_ok=True)
        os.makedirs(BACKUPS_DIR, exist_ok=True)
        logger.info(f"Папки створено: {MAPS_DIR}, {BACKUPS_DIR}")
        
        for filepath, default in [
            (TEMP_FILE, DEFAULT_MAP_STRUCTURE),
            (VERSIONS_FILE, {}),
            (DEFAULT_MAP_FILE, DEFAULT_MAP_STRUCTURE)
        ]:
            StorageManager.load_json(filepath, default)
            logger.info(f"Файл ініціалізовано: {filepath}")
        
        logger.info("Ініціалізація завершена!")


class MapManager:
    
    @staticmethod
    def generate_id(prefix: str) -> str:
        return f"{prefix}_{datetime.now().timestamp()}"
    
    @staticmethod
    def get_temp_data() -> Dict[str, List]:
        return StorageManager.load_json(TEMP_FILE, DEFAULT_MAP_STRUCTURE)
    
    @staticmethod
    def save_temp_data(data: Dict[str, List]) -> bool:
        return StorageManager.save_json(TEMP_FILE, data)
    
    @staticmethod
    def add_item(item_type: str, item_data: Dict) -> Tuple[bool, str, Optional[str]]:
        data = MapManager.get_temp_data()
        item_id = MapManager.generate_id(item_type)
        item_data['id'] = item_id
        data[f'{item_type}s'].append(item_data)
        
        success = MapManager.save_temp_data(data)
        return success, item_id, None if success else 'Помилка збереження'
    
    @staticmethod
    def update_item(item_type: str, item_id: str, item_data: Dict) -> Tuple[bool, Optional[str]]:
        data = MapManager.get_temp_data()
        items_key = f'{item_type}s'
        
        for i, item in enumerate(data[items_key]):
            if item.get('id') == item_id:
                data[items_key][i] = {**item_data, 'id': item_id}
                success = MapManager.save_temp_data(data)
                return success, None if success else 'Помилка збереження'
        
        return False, 'Елемент не знайдено'
    
    @staticmethod
    def delete_item(item_type: str, item_id: str) -> Tuple[bool, Optional[str]]:
        data = MapManager.get_temp_data()
        items_key = f'{item_type}s'
        data[items_key] = [item for item in data[items_key] if item.get('id') != item_id]
        
        success = MapManager.save_temp_data(data)
        return success, None if success else 'Помилка збереження'
    
    @staticmethod
    def save_version(map_name: str, comment: str) -> Tuple[bool, Optional[str]]:
        map_file = os.path.join(MAPS_DIR, f'{map_name}.json')
        new_map_data = MapManager.get_temp_data()
        
        now = datetime.now()
        timestamp_str = now.strftime('%Y%m%d_%H%M%S')
        timestamp_iso = now.isoformat()
        backup_filename = f'{map_name}_{timestamp_str}.json'
        backup_file = os.path.join(BACKUPS_DIR, backup_filename)
        
        if not StorageManager.save_json(backup_file, new_map_data):
            return False, 'Помилка збереження backup'
        
        if not StorageManager.save_json(map_file, new_map_data):
            return False, 'Помилка збереження карти'
        
        versions = StorageManager.load_json(VERSIONS_FILE, {})
        if map_name not in versions:
            versions[map_name] = []
        
        versions[map_name].append({
            'timestamp': timestamp_iso,
            'filename': backup_filename,
            'comment': comment,
            'markers_count': len(new_map_data.get('markers', [])),
            'polygons_count': len(new_map_data.get('polygons', []))
        })
        
        if not StorageManager.save_json(VERSIONS_FILE, versions):
            return False, 'Помилка збереження версій'
        
        logger.info(f"Карту збережено. Міток: {len(new_map_data.get('markers', []))}, "
                   f"Полігонів: {len(new_map_data.get('polygons', []))}")
        
        return True, None
    
    @staticmethod
    def load_version(map_name: str) -> Tuple[bool, Optional[Dict], Optional[str]]:
        map_file = os.path.join(MAPS_DIR, f'{map_name}.json')
        map_data = StorageManager.load_json(map_file, DEFAULT_MAP_STRUCTURE)
        
        if StorageManager.save_json(TEMP_FILE, map_data):
            logger.info(f"Завантажено карту: {len(map_data.get('markers', []))} міток, "
                       f"{len(map_data.get('polygons', []))} полігонів")
            return True, map_data, None
        
        return False, None, 'Помилка копіювання в тимчасовий файл'
    
    @staticmethod
    def restore_version(map_name: str, filename: str) -> Tuple[bool, Optional[str]]:
        backup_file = os.path.join(BACKUPS_DIR, filename)
        
        if not os.path.exists(backup_file):
            return False, 'Версію не знайдено'
        
        old_version_data = StorageManager.load_json(backup_file, DEFAULT_MAP_STRUCTURE)
        map_file = os.path.join(MAPS_DIR, f'{map_name}.json')
        
        if os.path.exists(map_file):
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            pre_restore_backup = os.path.join(BACKUPS_DIR, f'{map_name}_{timestamp}_before_restore.json')
            shutil.copy2(map_file, pre_restore_backup)
            logger.info(f"Створено backup перед відкатом: {map_name}_{timestamp}_before_restore.json")
        
        if not StorageManager.save_json(map_file, old_version_data):
            return False, 'Помилка збереження відновленої версії'
        
        if not StorageManager.save_json(TEMP_FILE, old_version_data):
            return False, 'Помилка оновлення temp файлу'
        
        versions = StorageManager.load_json(VERSIONS_FILE, {})
        if map_name in versions:
            restore_index = next((i for i, v in enumerate(versions[map_name]) 
                                if v.get('filename') == filename), None)
            
            if restore_index is not None:
                removed_count = len(versions[map_name]) - restore_index - 1
                versions[map_name] = versions[map_name][:restore_index + 1]
                
                if not StorageManager.save_json(VERSIONS_FILE, versions):
                    return False, 'Помилка оновлення списку версій'
                
                logger.info(f"Видалено {removed_count} новіших версій")
        
        logger.info(f"Відновлено версію: {filename}")
        logger.info(f"Міток: {len(old_version_data.get('markers', []))}, "
                   f"Полігонів: {len(old_version_data.get('polygons', []))}")
        
        return True, None


def handle_errors(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Помилка в {f.__name__}: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500
    return wrapper


StorageManager.initialize()


@app.route('/')
def hello_world():
    return render_template('index.html')


@app.route('/api/add-marker', methods=['POST'])
@handle_errors
def add_marker():
    marker_data = request.json
    success, marker_id, error = MapManager.add_item('marker', marker_data)
    
    if success:
        return jsonify({'success': True, 'id': marker_id})
    return jsonify({'success': False, 'error': error}), 500


@app.route('/api/add-polygon', methods=['POST'])
@handle_errors
def add_polygon():
    polygon_data = request.json
    success, polygon_id, error = MapManager.add_item('polygon', polygon_data)
    
    if success:
        return jsonify({'success': True, 'id': polygon_id})
    return jsonify({'success': False, 'error': error}), 500


@app.route('/api/update-marker/<marker_id>', methods=['PUT'])
@handle_errors
def update_marker(marker_id):
    marker_data = request.json
    success, error = MapManager.update_item('marker', marker_id, marker_data)
    
    if success:
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': error}), 500


@app.route('/api/update-polygon/<polygon_id>', methods=['PUT'])
@handle_errors
def update_polygon(polygon_id):
    polygon_data = request.json
    success, error = MapManager.update_item('polygon', polygon_id, polygon_data)
    
    if success:
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': error}), 500


@app.route('/api/delete-marker/<marker_id>', methods=['DELETE'])
@handle_errors
def delete_marker(marker_id):
    success, error = MapManager.delete_item('marker', marker_id)
    
    if success:
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': error}), 500


@app.route('/api/delete-polygon/<polygon_id>', methods=['DELETE'])
@handle_errors
def delete_polygon(polygon_id):
    success, error = MapManager.delete_item('polygon', polygon_id)
    
    if success:
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': error}), 500


@app.route('/api/get-all-data', methods=['GET'])
@handle_errors
def get_all_data():
    data = MapManager.get_temp_data()
    return jsonify({'success': True, 'data': data})


@app.route('/api/save-map', methods=['POST'])
@handle_errors
def save_map():
    data = request.json
    map_name = data.get('name', 'default')
    comment = data.get('comment', 'Без коментаря')
    
    success, error = MapManager.save_version(map_name, comment)
    
    if success:
        return jsonify({'success': True, 'message': 'Карту збережено!'})
    return jsonify({'success': False, 'error': error}), 500


@app.route('/api/load-map', methods=['GET'])
@handle_errors
def load_map():
    map_name = request.args.get('name', 'default')
    success, map_data, error = MapManager.load_version(map_name)
    
    if success:
        return jsonify({'success': True, 'data': map_data})
    return jsonify({'success': False, 'error': error}), 500


@app.route('/api/get-changes-history', methods=['GET'])
@handle_errors
def get_changes_history():
    map_name = request.args.get('name', 'default')
    versions = StorageManager.load_json(VERSIONS_FILE, {})
    map_versions = versions.get(map_name, [])
    map_versions.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    
    logger.info(f"Історія: {len(map_versions)} версій")
    return jsonify({'success': True, 'versions': map_versions})


@app.route('/api/restore-version', methods=['POST'])
@handle_errors
def restore_version():
    data = request.json
    map_name = data.get('name', 'default')
    filename = data.get('filename')
    
    success, error = MapManager.restore_version(map_name, filename)
    
    if success:
        return jsonify({'success': True, 'message': 'Версію відновлено!'})
    return jsonify({'success': False, 'error': error}), 500


@app.route('/api/debug-versions', methods=['GET'])
@handle_errors
def debug_versions():
    versions = StorageManager.load_json(VERSIONS_FILE, {})
    return jsonify({
        'success': True,
        'file_exists': os.path.exists(VERSIONS_FILE),
        'content': versions,
        'path': VERSIONS_FILE
    })


if __name__ == '__main__':
    app.run(debug=True)