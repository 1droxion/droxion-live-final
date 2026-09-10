import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const iosRoot = path.join(root, 'ios', 'App');
const appDir = path.join(iosRoot, 'App');
const projectPath = path.join(iosRoot, 'App.xcodeproj');
const swiftPath = path.join(appDir, 'TwitchPlayer.swift');

if (!fs.existsSync(projectPath)) {
  console.log('iOS project is not present; skipping Twitch native player configuration.');
  process.exit(0);
}

fs.mkdirSync(appDir, { recursive: true });

const swiftSource = `import UIKit
import WebKit
import Capacitor

@objc(TwitchPlayer)
public class TwitchPlayer: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "TwitchPlayer"
    public let jsName = "TwitchPlayer"

    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateFrame", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise)
    ]

    private var playerWebView: WKWebView?
    private var loadedURL: String?

    private func number(_ call: CAPPluginCall, key: String) -> CGFloat {
        if let value = call.options[key] as? NSNumber {
            return CGFloat(truncating: value)
        }
        return 0
    }

    private func frameFromCall(_ call: CAPPluginCall) -> CGRect? {
        let x = number(call, key: "x")
        let y = number(call, key: "y")
        let width = number(call, key: "width")
        let height = number(call, key: "height")

        guard width > 1, height > 1 else {
            return nil
        }

        guard let hostView = bridge?.viewController?.view else {
            return nil
        }

        if let hostWebView = bridge?.webView {
            let origin = hostWebView.convert(
                CGPoint(x: x, y: y),
                to: hostView
            )

            return CGRect(
                x: origin.x,
                y: origin.y,
                width: width,
                height: height
            ).integral
        }

        return CGRect(
            x: x,
            y: y,
            width: width,
            height: height
        ).integral
    }

    private func makePlayer(frame: CGRect) -> WKWebView {
        let configuration = WKWebViewConfiguration()

        configuration.allowsInlineMediaPlayback = true
        configuration.allowsPictureInPictureMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(
            frame: frame,
            configuration: configuration
        )

        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        webView.isOpaque = true
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        webView.layer.masksToBounds = true

        return webView
    }

    @objc public func show(_ call: CAPPluginCall) {
        guard
            let urlString = call.getString("url"),
            let url = URL(string: urlString)
        else {
            call.reject("Invalid Twitch player URL")
            return
        }

        DispatchQueue.main.async {
            guard
                let hostView = self.bridge?.viewController?.view,
                let frame = self.frameFromCall(call)
            else {
                call.reject("Unable to position Twitch player")
                return
            }

            let player: WKWebView

            if let existing = self.playerWebView {
                player = existing
            } else {
                player = self.makePlayer(frame: frame)
                self.playerWebView = player
                hostView.addSubview(player)
            }

            player.frame = frame.intersection(hostView.bounds)
            player.isHidden = false
            player.isUserInteractionEnabled = false

            hostView.bringSubviewToFront(player)

            if self.loadedURL != urlString {
                player.stopLoading()

                let request = URLRequest(
                    url: url,
                    cachePolicy: .reloadIgnoringLocalCacheData,
                    timeoutInterval: 30
                )

                player.load(request)
                self.loadedURL = urlString
            }

            call.resolve()
        }
    }

    @objc public func updateFrame(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let player = self.playerWebView else {
                call.resolve()
                return
            }

            guard let frame = self.frameFromCall(call) else {
                call.resolve()
                return
            }

            player.frame = frame

            if let hostView = self.bridge?.viewController?.view {
                hostView.bringSubviewToFront(player)
            }

            call.resolve()
        }
    }

    @objc public func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.playerWebView?.stopLoading()
            self.playerWebView?.removeFromSuperview()
            self.playerWebView = nil
            self.loadedURL = nil
            call.resolve()
        }
    }
}
`;

fs.writeFileSync(swiftPath, swiftSource, 'utf8');

const rubyScript = `
require 'xcodeproj'

project_path = ARGV[0]
project = Xcodeproj::Project.open(project_path)

app_group = project.main_group.children.find do |child|
  child.respond_to?(:display_name) && child.display_name == 'App'
end

raise 'Could not find App group in Xcode project' unless app_group

target = project.targets.find { |item| item.name == 'App' }

raise 'Could not find App target in Xcode project' unless target

file_ref = app_group.files.find do |file|
  file.path == 'TwitchPlayer.swift'
end

file_ref ||= app_group.new_file('TwitchPlayer.swift')

target.add_file_references([file_ref])

project.save
`;

execFileSync(
  'ruby',
  ['-e', rubyScript, projectPath],
  { stdio: 'inherit' }
);

console.log('Configured native iOS Twitch WKWebView player.');
