# v192 change summary

This narrow change fixes the remaining code-level iPhone viewport risk after v190:
Safari/other iPhone browser chrome can make the currently visible viewport shorter than
`100lvh`. JARVIS now measures the visible viewport and applies those dimensions to the
mobile root while preserving the locked cockpit composition and existing authority path.
