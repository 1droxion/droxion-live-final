import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const iosRoot = path.join(root, 'ios', 'App');
const appDir = path.join(iosRoot, 'App');
const projectPath = path.join(iosRoot, 'App.xcodeproj');
const storyboardPath = path.join(appDir, 'Base.lproj', 'Main.storyboard');
const controllerPath = path.join(appDir, 'DroxionBridgeViewController.swift');

if (!fs.existsSync(projectPath) || !fs.existsSync(storyboardPath)) {
  console.log('Generated iOS project is not present; skipping Twitch plugin registration.');
  process.exit(0);
}

const controllerSource = `import UIKit
import Capacitor

class DroxionBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(TwitchPlayer())
    }
}
`;

fs.writeFileSync(controllerPath, controllerSource, 'utf8');

let storyboard = fs.readFileSync(storyboardPath, 'utf8');

const oldController =
  'customClass="CAPBridgeViewController" customModule="Capacitor"';

const newController =
  'customClass="DroxionBridgeViewController" customModule="App" customModuleProvider="target"';

if (storyboard.includes(oldController)) {
  storyboard = storyboard.replace(oldController, newController);
} else if (!storyboard.includes('customClass="DroxionBridgeViewController"')) {
  storyboard = storyboard.replace(
    /customClass="CAPBridgeViewController"[^>]*?/,
    'customClass="DroxionBridgeViewController" customModule="App" customModuleProvider="target"'
  );
}

if (!storyboard.includes('customClass="DroxionBridgeViewController"')) {
  throw new Error('Could not configure DroxionBridgeViewController in Main.storyboard.');
}

fs.writeFileSync(storyboardPath, storyboard, 'utf8');

const rubyScript = `
require 'xcodeproj'

project_path = ARGV[0]
project = Xcodeproj::Project.open(project_path)

app_group = project.main_group.children.find do |child|
  child.respond_to?(:display_name) && child.display_name == 'App'
end

raise 'Could not find App group' unless app_group

target = project.targets.find { |item| item.name == 'App' }

raise 'Could not find App target' unless target

file_ref = app_group.files.find do |file|
  file.path == 'DroxionBridgeViewController.swift'
end

file_ref ||= app_group.new_file('DroxionBridgeViewController.swift')

unless target.source_build_phase.files_references.include?(file_ref)
  target.add_file_references([file_ref])
end

project.save
`;

execFileSync(
  'ruby',
  ['-e', rubyScript, projectPath],
  { stdio: 'inherit' }
);

console.log('Registered TwitchPlayer with DroxionBridgeViewController.');
