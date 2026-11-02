"""Exercise capture wakeup without Flask, FFmpeg, USB hardware, or global threads."""
import ast
import logging
import os
from pathlib import Path
import subprocess
import threading
import time
import unittest

source = ast.parse((Path(__file__).parents[1] / 'camera_service.py').read_text())
nodes = [node for node in source.body if isinstance(node, (ast.FunctionDef, ast.ClassDef)) and node.name in {'env_int', 'env_float', 'env_bool', 'CameraStreamer'}]
scope = dict(os=os, subprocess=subprocess, threading=threading, time=time, logger=logging.getLogger(__name__))
exec(compile(ast.Module(body=nodes, type_ignores=[]), 'camera_service.py', 'exec'), scope)
CameraStreamer = scope['CameraStreamer']

class CaptureWakeupTests(unittest.TestCase):
    def test_first_viewer_wakes_idle_capture_immediately(self):
        camera = CameraStreamer()
        camera.set_enabled(True)
        result = []
        worker = threading.Thread(target=lambda: result.append(camera.wait_for_viewer(timeout=2)))
        worker.start()
        time.sleep(0.03)
        camera.add_stream_viewer()
        worker.join(timeout=0.3)
        self.assertFalse(worker.is_alive(), 'Viewer notification did not wake capture promptly')
        self.assertEqual(result, [True])

    def test_disabled_camera_does_not_wake_until_enabled(self):
        camera = CameraStreamer()
        camera.set_enabled(False)
        camera.add_stream_viewer()
        result = []
        worker = threading.Thread(target=lambda: result.append(camera.wait_for_viewer(timeout=2)))
        worker.start()
        time.sleep(0.03)
        self.assertTrue(worker.is_alive())
        camera.set_enabled(True)
        worker.join(timeout=0.3)
        self.assertEqual(result, [True])

    def test_restarted_sidecar_stays_disabled_until_backend_restores_privacy(self):
        camera = CameraStreamer()
        camera.add_stream_viewer()
        self.assertFalse(camera.enabled)
        self.assertFalse(camera.wait_for_viewer(timeout=0.01))

    def test_no_viewers_keeps_capture_asleep(self):
        camera = CameraStreamer()
        self.assertFalse(camera.wait_for_viewer(timeout=0.01))

if __name__ == '__main__':
    unittest.main()
