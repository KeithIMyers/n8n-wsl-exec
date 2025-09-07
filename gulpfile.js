const gulp = require('gulp');
const path = require('path');
const fs = require('fs');

const icons = () => {
	const dest = 'dist/nodes/WslExec';
	if (!fs.existsSync(dest)) {
		fs.mkdirSync(dest, { recursive: true });
	}
	return gulp.src('nodes/WslExec/WslExec.node.icon.svg').pipe(gulp.dest(dest));
};

gulp.task('build:icons', icons);
