# Adds ReadRx's own Swift files to the App target of the Xcode project (once).
# Usage: ruby add-native-files.rb ios/App/App.xcodeproj File.swift …
require 'xcodeproj'

project_path, *files = ARGV
project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |t| t.name == 'App' }
group = project.main_group['App']
files.each do |name|
  next if group.files.any? { |f| f.path == name }
  target.add_file_references([group.new_reference(name)])
end
project.save
